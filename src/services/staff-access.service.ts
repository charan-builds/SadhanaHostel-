import "server-only"

import type { User } from "@supabase/supabase-js"

import {
  ROLE_PERMISSIONS,
  type PermissionKey,
} from "@/constants/auth"
import { getServerEnv } from "@/config/env"
import { badRequest, conflict, forbidden, notFound } from "@/lib/api/api-error"
import { logAuditEvent } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  StaffAccessRepository,
  type StaffAccountRow,
} from "@/repositories/staff-access.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { EmailQueueService } from "@/services/email"
import { RealtimeEventPublisher } from "@/services/realtime"
import type { Json } from "@/types/database"
import {
  createStaffUserSchema,
  listStaffUsersSchema,
  staffAccessActionSchema,
  updateStaffAccessSchema,
  type StaffAccountState,
  type StaffRole,
} from "@/validations/staff-access.validation"

import { AuthService, type AuthContext } from "./auth.service"

const DEFAULT_TEMP_PASSWORD_HOURS = 24

export type StaffAccessAccount = StaffAccountRow & {
  accountState: StaffAccountState
  forcePasswordReset: boolean
}

export type CreatedStaffAccess = {
  account: StaffAccessAccount
  inviteLink: string | null
  temporaryPassword: string | null
  expiresAt: string
}

export type StaffPasswordResetResult = {
  targetUserId: string
  temporaryPassword: string
  expiresAt: string
}

export class StaffAccessService {
  private readonly authService: AuthService
  private readonly staffRepository: StaffAccessRepository
  private readonly emailQueue = new EmailQueueService()
  private readonly eventPublisher = new RealtimeEventPublisher()

  constructor(
    private readonly serverDb: AppSupabaseClient,
    private readonly adminDb: AppSupabaseClient
  ) {
    this.authService = new AuthService(serverDb)
    this.staffRepository = new StaffAccessRepository(adminDb)
  }

  static async create() {
    return new StaffAccessService(
      await createSupabaseServerClient(),
      createSupabaseAdminClient()
    )
  }

  async listStaff(input: unknown) {
    const values = listStaffUsersSchema.parse(input)
    const context = await this.requireIamManager()
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const result = await this.staffRepository.listStaff({
      ...values,
      ...(hostelId ? { hostelId } : {}),
    })

    return {
      ...result,
      data: result.data.map(toStaffAccessAccount),
    }
  }

  async createStaff(input: unknown): Promise<CreatedStaffAccess> {
    const values = createStaffUserSchema.parse(input)
    const context = await this.requireIamManager()
    const permissions = this.resolvePermissions(values.role, values.permissions)
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )
    const expiresAt = new Date(
      Date.now() +
        values.expiresInHours * 60 * 60 * 1000
    ).toISOString()

    this.assertCanAssignRole(context, values.role)

    const existingProfile = await this.staffRepository.getUserByEmail(values.email)

    if (existingProfile?.organization_id && existingProfile.organization_id !== values.organizationId) {
      throw conflict("This email already belongs to another organization.")
    }

    const authResult =
      values.deliveryMode === "invite_link"
        ? await this.createInviteAuthUser(values)
        : await this.createTemporaryPasswordAuthUser(values, expiresAt)

    await this.syncAndUpdateProfile({
      authUser: authResult.user,
      organizationId: values.organizationId,
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      role: values.role,
      accountStatus: values.deliveryMode === "invite_link" ? "invited" : "active",
      forcePasswordReset: values.deliveryMode === "temp_password",
      expiresAt,
      actorUserId: context.authUser.id,
    })

    const roleAssignment = await this.staffRepository.createRoleAssignment({
      organization_id: values.organizationId,
      hostel_id: hostelId,
      user_id: authResult.user.id,
      role: values.role,
      permissions: permissions satisfies Json,
      status: values.deliveryMode === "invite_link" ? "invited" : "active",
      invited_by: context.authUser.id,
      invited_at: new Date().toISOString(),
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
    const user = await this.staffRepository.getUserById(
      authResult.user.id,
      values.organizationId
    )

    if (!user) {
      throw notFound("Created staff profile could not be loaded.")
    }

    await this.sendStaffAccessEmail({
      email: values.email,
      fullName: values.fullName,
      organizationId: values.organizationId,
      inviteLink: authResult.inviteLink,
      temporaryPassword: authResult.temporaryPassword,
      expiresAt,
    })
    await this.publish("staff.created", values.organizationId, hostelId, context, {
      targetUserId: authResult.user.id,
      role: values.role,
      deliveryMode: values.deliveryMode,
    })
    this.audit("staff.created", context, values.organizationId, authResult.user.id, {
      role: values.role,
      hostelId,
      deliveryMode: values.deliveryMode,
    })

    return {
      account: toStaffAccessAccount({
        ...roleAssignment,
        user,
        hostel: null,
      }),
      inviteLink: authResult.inviteLink,
      temporaryPassword: authResult.temporaryPassword,
      expiresAt,
    }
  }

  async updateStaff(input: unknown) {
    const values = updateStaffAccessSchema.parse(input)
    const context = await this.requireIamManager()
    const currentAssignment =
      values.roleAssignmentId
        ? null
        : await this.staffRepository.getPrimaryRoleAssignment(
            values.targetUserId,
            values.organizationId
          )
    const roleAssignmentId = values.roleAssignmentId ?? currentAssignment?.id

    this.authService.requireOrganizationAccess(context, values.organizationId)

    if (!roleAssignmentId) {
      throw notFound("Staff role assignment not found.")
    }

    const existingAssignment =
      currentAssignment ??
      (await this.staffRepository.getRoleAssignmentById(
        roleAssignmentId,
        values.organizationId
      ))

    if (!existingAssignment) {
      throw notFound("Staff role assignment not found.")
    }

    if (existingAssignment.user_id !== values.targetUserId) {
      throw forbidden("Role assignment does not belong to the target staff user.")
    }

    this.authService.requireHostelAccess(
      context,
      existingAssignment.organization_id,
      existingAssignment.hostel_id
    )

    const hasHostelUpdate = Object.prototype.hasOwnProperty.call(values, "hostelId")
    const nextHostelId = hasHostelUpdate
      ? this.authService.resolveHostelScope(
          context,
          values.organizationId,
          values.hostelId
        )
      : undefined

    if (values.role) {
      this.assertCanAssignRole(context, values.role)
    }

    if (
      values.targetUserId === context.authUser.id &&
      (values.status === "suspended" ||
        values.status === "locked" ||
        values.status === "deleted")
    ) {
      throw forbidden("You cannot suspend, lock, or delete your own access.")
    }

    if (values.status === "deleted" || values.status === "suspended") {
      await this.assertNotLastPrivilegedUser(values.organizationId, values.targetUserId)
    }

    const nextPermissions = values.role
      ? this.resolvePermissions(values.role, values.permissions ?? [])
      : values.permissions

    const assignment = await this.staffRepository.updateRoleAssignment(
      roleAssignmentId,
      values.organizationId,
      {
        hostel_id: hasHostelUpdate ? nextHostelId : undefined,
        role: values.role,
        permissions: nextPermissions as Json | undefined,
        status: values.status,
        updated_by: context.authUser.id,
        deleted_at: values.status === "deleted" ? new Date().toISOString() : undefined,
        deleted_by: values.status === "deleted" ? context.authUser.id : undefined,
      }
    )

    if (values.role) {
      await this.syncProfileRole({
        targetUserId: values.targetUserId,
        organizationId: values.organizationId,
        role: values.role,
        actorUserId: context.authUser.id,
      })
    }

    if (values.status) {
      await this.setAccountState({
        targetUserId: values.targetUserId,
        organizationId: values.organizationId,
        status: values.status,
        actorUserId: context.authUser.id,
      })
    }

    await this.publish(
      values.status === "deleted" ? "staff.access_revoked" : "staff.role_changed",
      values.organizationId,
      assignment.hostel_id,
      context,
      {
        targetUserId: values.targetUserId,
        roleAssignmentId: assignment.id,
        role: assignment.role,
        status: assignment.status,
      }
    )
    this.audit("staff.updated", context, values.organizationId, values.targetUserId, {
      roleAssignmentId: assignment.id,
      role: assignment.role,
      status: assignment.status,
    })

    return assignment
  }

  async revokeStaff(input: unknown) {
    const values = staffAccessActionSchema.parse(input)

    return this.updateStaff({
      organizationId: values.organizationId,
      targetUserId: values.targetUserId,
      status: "deleted",
    })
  }

  async resetTemporaryPassword(input: unknown): Promise<StaffPasswordResetResult> {
    const values = staffAccessActionSchema.parse(input)
    const context = await this.requireIamManager()
    const user = await this.staffRepository.getUserById(
      values.targetUserId,
      values.organizationId
    )

    this.authService.requireOrganizationAccess(context, values.organizationId)

    if (!user?.email) {
      throw badRequest("Staff user needs an email before password reset can be generated.")
    }

    const assignment = await this.staffRepository.getPrimaryRoleAssignment(
      values.targetUserId,
      values.organizationId
    )

    if (!assignment) {
      throw notFound("Staff role assignment not found.")
    }

    this.authService.requireHostelAccess(
      context,
      assignment.organization_id,
      assignment.hostel_id
    )

    const temporaryPassword = generateTemporaryPassword()
    const expiresAt = new Date(
      Date.now() + DEFAULT_TEMP_PASSWORD_HOURS * 60 * 60 * 1000
    ).toISOString()
    const { error } = await this.adminDb.auth.admin.updateUserById(values.targetUserId, {
      password: temporaryPassword,
      user_metadata: {
        force_password_reset: true,
        temporary_password_expires_at: expiresAt,
      },
    })

    if (error) {
      throw forbidden(error.message)
    }

    await this.patchUserMetadata(values.targetUserId, values.organizationId, {
      force_password_reset: true,
      temporary_password_expires_at: expiresAt,
      account_status: "active",
    })
    await this.publish("staff.password_reset", values.organizationId, null, context, {
      targetUserId: values.targetUserId,
      expiresAt,
    })
    this.audit("staff.password_reset", context, values.organizationId, values.targetUserId, {
      expiresAt,
    })

    return {
      targetUserId: values.targetUserId,
      temporaryPassword,
      expiresAt,
    }
  }

  private async requireIamManager() {
    return this.authService.requirePermission("iam.manage")
  }

  private assertCanAssignRole(context: AuthContext, role: StaffRole) {
    if (context.roles.includes("super_admin")) {
      return
    }

    if (role === "owner" && !context.roles.includes("owner")) {
      throw forbidden("Only owners can assign owner access.")
    }

    if (
      context.roles.includes("admin") &&
      (role === "owner" || role === "admin")
    ) {
      throw forbidden("Admins cannot grant owner or admin access.")
    }
  }

  private async assertNotLastPrivilegedUser(organizationId: string, targetUserId: string) {
    const remaining = await this.staffRepository.countActivePrivileged(
      organizationId,
      targetUserId
    )

    if (remaining === 0) {
      throw forbidden("At least one active owner or admin must remain.")
    }
  }

  private async createInviteAuthUser(values: {
    email: string
    fullName: string
    organizationId: string
    role: StaffRole
  }) {
    const env = getServerEnv()
    const { data, error } = await this.adminDb.auth.admin.generateLink({
      type: "invite",
      email: values.email,
      options: {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/login`,
        data: {
          full_name: values.fullName,
          organization_id: values.organizationId,
          default_role: values.role,
          invited_as_staff: true,
        },
      },
    })

    if (error || !data.user) {
      throw forbidden(error?.message ?? "Unable to generate staff invite.")
    }

    return {
      user: data.user,
      inviteLink: data.properties?.action_link ?? `${env.NEXT_PUBLIC_APP_URL}/login`,
      temporaryPassword: null,
    }
  }

  private async createTemporaryPasswordAuthUser(
    values: {
      email: string
      fullName: string
      phone?: string
      organizationId: string
      role: StaffRole
    },
    expiresAt: string
  ) {
    const existing = await this.findAuthUserByEmail(values.email)
    const temporaryPassword = generateTemporaryPassword()
    const userMetadata = {
      full_name: values.fullName,
      organization_id: values.organizationId,
      default_role: values.role,
      force_password_reset: true,
      temporary_password_expires_at: expiresAt,
      invited_as_staff: true,
    }

    if (existing) {
      const { data, error } = await this.adminDb.auth.admin.updateUserById(existing.id, {
        password: temporaryPassword,
        email_confirm: true,
        phone_confirm: Boolean(values.phone),
        user_metadata: userMetadata,
      })

      if (error || !data.user) {
        throw forbidden(error?.message ?? "Unable to update staff auth account.")
      }

      return {
        user: data.user,
        inviteLink: null,
        temporaryPassword,
      }
    }

    const { data, error } = await this.adminDb.auth.admin.createUser({
      email: values.email,
      phone: values.phone,
      password: temporaryPassword,
      email_confirm: true,
      phone_confirm: Boolean(values.phone),
      user_metadata: userMetadata,
    })

    if (error || !data.user) {
      throw forbidden(error?.message ?? "Unable to create staff auth account.")
    }

    return {
      user: data.user,
      inviteLink: null,
      temporaryPassword,
    }
  }

  private async syncAndUpdateProfile(input: {
    authUser: User
    organizationId: string
    fullName: string
    email: string
    phone?: string
    role: StaffRole
    accountStatus: StaffAccountState
    forcePasswordReset: boolean
    expiresAt: string
    actorUserId: string
  }) {
    const { error } = await this.adminDb.rpc("sync_auth_user", {
      target_user_id: input.authUser.id,
    })

    if (error) {
      throw forbidden(error.message)
    }

    const current = await this.staffRepository.getUserById(
      input.authUser.id,
      input.organizationId
    )
    const metadata = {
      ...recordFromJson(current?.metadata),
      account_status: input.accountStatus,
      force_password_reset: input.forcePasswordReset,
      temporary_password_expires_at: input.expiresAt,
      staff_access_managed: true,
    }

    await this.staffRepository.updateUser(input.authUser.id, {
      organization_id: input.organizationId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      default_role: input.role,
      is_active: input.accountStatus !== "deleted" && input.accountStatus !== "suspended",
      metadata: metadata as Json,
      updated_by: input.actorUserId,
    })
  }

  private async setAccountState(input: {
    targetUserId: string
    organizationId: string
    status: StaffAccountState
    actorUserId: string
  }) {
    const user = await this.staffRepository.getUserById(
      input.targetUserId,
      input.organizationId
    )

    if (!user) {
      throw notFound("Staff user not found.")
    }

    await this.staffRepository.updateUser(input.targetUserId, {
      is_active: input.status === "active" || input.status === "invited",
      metadata: {
        ...recordFromJson(user.metadata),
        account_status: input.status,
      } as Json,
      updated_by: input.actorUserId,
      deleted_at: input.status === "deleted" ? new Date().toISOString() : undefined,
      deleted_by: input.status === "deleted" ? input.actorUserId : undefined,
    })

    if (input.status === "suspended" || input.status === "locked" || input.status === "deleted") {
      await this.adminDb.auth.admin.updateUserById(input.targetUserId, {
        ban_duration: "876000h",
      })
    } else if (input.status === "active" || input.status === "invited") {
      await this.adminDb.auth.admin.updateUserById(input.targetUserId, {
        ban_duration: "none",
      })
    }
  }

  private async syncProfileRole(input: {
    targetUserId: string
    organizationId: string
    role: StaffRole
    actorUserId: string
  }) {
    const user = await this.staffRepository.getUserById(
      input.targetUserId,
      input.organizationId
    )

    if (!user) {
      throw notFound("Staff user not found.")
    }

    await this.staffRepository.updateUser(input.targetUserId, {
      default_role: input.role,
      metadata: {
        ...recordFromJson(user.metadata),
        staff_access_managed: true,
      } as Json,
      updated_by: input.actorUserId,
    })
  }

  private async patchUserMetadata(
    userId: string,
    organizationId: string,
    patch: Record<string, unknown>
  ) {
    const user = await this.staffRepository.getUserById(userId, organizationId)
    const metadata = {
      ...recordFromJson(user?.metadata),
      ...patch,
    }

    await this.staffRepository.updateUser(userId, {
      metadata: metadata as Json,
      is_active: patch.account_status !== "suspended" && patch.account_status !== "deleted",
    })
  }

  private resolvePermissions(role: StaffRole, explicitPermissions: string[]) {
    const defaultPermissions = ROLE_PERMISSIONS[role] ?? []

    return Array.from(new Set([...defaultPermissions, ...explicitPermissions])) as PermissionKey[]
  }

  private async findAuthUserByEmail(email: string) {
    const normalized = email.toLowerCase()

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await this.adminDb.auth.admin.listUsers({
        page,
        perPage: 100,
      })

      if (error) {
        throw forbidden(error.message)
      }

      const user = data.users.find(
        (candidate) => candidate.email?.toLowerCase() === normalized
      )

      if (user) {
        return user
      }

      if (data.users.length < 100) {
        return null
      }
    }

    return null
  }

  private async sendStaffAccessEmail(input: {
    email: string
    fullName: string
    organizationId: string
    inviteLink: string | null
    temporaryPassword: string | null
    expiresAt: string
  }) {
    await this.emailQueue.sendTemplate({
      to: input.email,
      title: "Your hostel staff access is ready",
      body:
        `Hello ${input.fullName}, your Sadhana Boys Hostel staff access is ready. ` +
        (input.inviteLink
          ? "Use the secure invite link to activate your account."
          : "Use the temporary password shown by your admin and reset it after login."),
      templateKey: "staff_access",
      payload: {
        invite_link: input.inviteLink,
        expires_at: input.expiresAt,
      },
      organizationId: input.organizationId,
      idempotencyKey: `staff-access-${input.email}-${Date.now()}`,
    })
  }

  private publish(
    type: "staff.created" | "staff.role_changed" | "staff.access_revoked" | "staff.password_reset",
    organizationId: string,
    hostelId: string | null | undefined,
    context: AuthContext,
    payload: Json
  ) {
    return this.eventPublisher.publish({
      type,
      organizationId,
      hostelId,
      actorUserId: context.authUser.id,
      payload,
    })
  }

  private audit(
    action: string,
    context: AuthContext,
    organizationId: string,
    targetUserId: string,
    details: Record<string, unknown>
  ) {
    logAuditEvent({
      action,
      actorUserId: context.authUser.id,
      organizationId,
      targetTable: "users",
      targetId: targetUserId,
      outcome: "success",
      details,
    })
  }
}

function toStaffAccessAccount(row: StaffAccountRow): StaffAccessAccount {
  const metadata = recordFromJson(row.user.metadata)
  const metadataStatus = metadata.account_status

  return {
    ...row,
    accountState:
      typeof metadataStatus === "string"
        ? (metadataStatus as StaffAccountState)
        : (row.status as StaffAccountState),
    forcePasswordReset: metadata.force_password_reset === true,
  }
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"
  const bytes = crypto.getRandomValues(new Uint8Array(18))

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

function recordFromJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
