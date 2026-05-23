import "server-only"

import type { User } from "@supabase/supabase-js"

import { ADMIN_PORTAL_ROLES, ADMIN_ROLES, AUTH_REDIRECTS, type AppRole } from "@/constants/auth"
import {
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api/api-error"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OrganizationsRepository } from "@/repositories/organizations.repository"
import { UsersRepository, type UserRoleRow, type UserRow } from "@/repositories/users.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  adminOnboardingSchema,
  loginSchema,
  residentOnboardingSchema,
  resetPasswordSchema,
} from "@/validations/auth.validation"

const ROLE_PRIORITY: Record<AppRole, number> = {
  super_admin: 100,
  owner: 90,
  admin: 80,
  finance: 70,
  warden: 65,
  staff: 60,
  receptionist: 55,
  resident: 30,
  parent: 20,
}

export type AuthContext = {
  authUser: User
  profile: UserRow
  roleAssignments: UserRoleRow[]
  roles: AppRole[]
  primaryRole: AppRole
  organizationId: string | null
  hostelIds: string[]
}

export type SessionOverview = {
  authenticated: boolean
  user: Pick<User, "id" | "email" | "phone"> | null
  profile: Pick<UserRow, "id" | "full_name" | "email" | "phone" | "default_role" | "organization_id"> | null
  roles: AppRole[]
  primaryRole: AppRole | null
  organizationId: string | null
  hostelIds: string[]
  onboardingRequired: boolean
  redirectTo: string
}

export class AuthService {
  private readonly usersRepository: UsersRepository
  private readonly organizationsRepository: OrganizationsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.usersRepository = new UsersRepository(db)
    this.organizationsRepository = new OrganizationsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new AuthService(db)
  }

  async getCurrentAuthUser() {
    const {
      data: { user },
      error,
    } = await this.db.auth.getUser()

    if (error || !user) {
      throw unauthorized()
    }

    return user
  }

  async getCurrentContext(): Promise<AuthContext> {
    const authUser = await this.getCurrentAuthUser()
    let profile = await this.usersRepository.getById(authUser.id)

    if (!profile) {
      await this.db.rpc("sync_auth_user", {
        target_user_id: authUser.id,
      })
      profile = await this.usersRepository.getById(authUser.id)
    }

    if (
      !profile ||
      profile.deleted_at ||
      !profile.is_active
    ) {
      throw unauthorized("Your user profile is inactive or missing.")
    }

    const accountStatus = getAccountStatus(profile.metadata)

    if (
      accountStatus === "suspended" ||
      accountStatus === "locked" ||
      accountStatus === "deleted"
    ) {
      throw unauthorized("Your user profile is inactive or missing.")
    }

    const roleAssignments = await this.usersRepository.getRoleAssignments(authUser.id)
    const roles = this.resolveRoles(profile, roleAssignments)
    const organizationId =
      profile.organization_id ?? roleAssignments[0]?.organization_id ?? null
    let hostelIds = [
      ...new Set(roleAssignments.map((role) => role.hostel_id).filter(Boolean)),
    ] as string[]

    if (
      organizationId &&
      hostelIds.length === 0 &&
      roles.some((role) => (ADMIN_ROLES as readonly AppRole[]).includes(role))
    ) {
      const activeHostels = await this.organizationsRepository.listActiveHostels(
        organizationId
      )
      hostelIds = activeHostels.map((hostel) => hostel.id)
    }

    return {
      authUser,
      profile,
      roleAssignments,
      roles,
      primaryRole: roles[0] ?? profile.default_role,
      organizationId,
      hostelIds,
    }
  }

  async requireRole(allowedRoles: readonly AppRole[]) {
    const context = await this.getCurrentContext()

    if (!context.roles.some((role) => allowedRoles.includes(role))) {
      throw forbidden("Your role does not allow this action.")
    }

    return context
  }

  async requireAdmin() {
    return this.requireRole(ADMIN_ROLES)
  }

  async login(input: unknown): Promise<SessionOverview> {
    const values = loginSchema.parse(input)
    const identifier = values.identifier ?? values.email ?? values.phone ?? ""
    const passwordCredentials = identifier.includes("@")
      ? {
          email: identifier,
          password: values.password,
        }
      : {
          phone: values.phone ?? identifier,
          password: values.password,
        }
    const { error } = await this.db.auth.signInWithPassword({
      ...passwordCredentials,
    })

    if (error) {
      throw unauthorized("Invalid email or password.")
    }

    const context = await this.getCurrentContext()

    return this.toSessionOverview(context)
  }

  async logout() {
    const { error } = await this.db.auth.signOut()

    if (error) {
      throw unauthorized(error.message)
    }

    return { authenticated: false }
  }

  async resetPassword(input: unknown) {
    const values = resetPasswordSchema.parse(input)
    const { error } = await this.db.auth.resetPasswordForEmail(values.email, {
      redirectTo: values.redirectTo,
    })

    if (error) {
      throw unauthorized(error.message)
    }

    return { email: values.email }
  }

  async getSessionOverview(): Promise<SessionOverview> {
    const {
      data: { user },
    } = await this.db.auth.getUser()

    if (!user) {
      return {
        authenticated: false,
        user: null,
        profile: null,
        roles: [],
        primaryRole: null,
        organizationId: null,
        hostelIds: [],
        onboardingRequired: false,
        redirectTo: AUTH_REDIRECTS.login,
      }
    }

    const context = await this.getCurrentContext()

    return this.toSessionOverview(context)
  }

  requireOrganizationAccess(context: AuthContext, organizationId: string) {
    if (context.roles.includes("super_admin")) {
      return
    }

    const profileMatches = context.profile.organization_id === organizationId
    const roleMatches = context.roleAssignments.some(
      (assignment) =>
        assignment.organization_id === organizationId && assignment.status === "active"
    )

    if (!profileMatches && !roleMatches) {
      throw forbidden("You cannot access data from another organization.")
    }
  }

  requireHostelAccess(
    context: AuthContext,
    organizationId: string,
    hostelId?: string | null
  ) {
    this.requireOrganizationAccess(context, organizationId)

    if (!hostelId || context.roles.includes("super_admin")) {
      return
    }

    const scopedRoleMatches = context.roleAssignments.some(
      (assignment) =>
        assignment.organization_id === organizationId &&
        assignment.status === "active" &&
        (!assignment.hostel_id || assignment.hostel_id === hostelId)
    )

    if (!scopedRoleMatches && !context.hostelIds.includes(hostelId)) {
      throw forbidden("You cannot access data from another hostel.")
    }
  }

  async onboardResident(input: unknown) {
    const values = residentOnboardingSchema.parse(input)
    const context = await this.requireAdmin()
    const { data: resident, error: residentError } = await this.db
      .from("residents")
      .select("organization_id")
      .eq("id", values.residentId)
      .is("deleted_at", null)
      .maybeSingle()

    if (residentError) {
      throw forbidden("Unable to validate resident tenant scope.")
    }

    if (!resident) {
      throw notFound("Resident not found.")
    }

    this.requireOrganizationAccess(context, resident.organization_id)

    const adminDb = createSupabaseAdminClient()
    const { data, error } = await adminDb.rpc("onboard_resident", {
      target_resident_id: values.residentId,
      target_user_id: values.userId,
    })

    if (error) {
      throw forbidden(error.message)
    }

    return data
  }

  async onboardAdmin(input: unknown) {
    const values = adminOnboardingSchema.parse(input)
    const context = await this.requireAdmin()

    this.requireOrganizationAccess(context, values.organizationId)

    if (!(ADMIN_ROLES as readonly AppRole[]).includes(values.role)) {
      throw forbidden("Only owner/admin roles can be onboarded through this workflow.")
    }

    const adminDb = createSupabaseAdminClient()
    const { data, error } = await adminDb.rpc("onboard_admin", {
      target_user_id: values.userId,
      target_organization_id: values.organizationId,
      target_hostel_id: values.hostelId,
      target_role: values.role,
    })

    if (error) {
      throw forbidden(error.message)
    }

    return data
  }

  private resolveRoles(profile: UserRow, roleAssignments: UserRoleRow[]) {
    const roles = new Set<AppRole>()
    roles.add(profile.default_role)

    roleAssignments.forEach((assignment) => {
      if (assignment.status === "active") {
        roles.add(assignment.role)
      }
    })

    return [...roles].sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])
  }

  private toSessionOverview(context: AuthContext): SessionOverview {
    return {
      authenticated: true,
      user: {
        id: context.authUser.id,
        email: context.authUser.email,
        phone: context.authUser.phone,
      },
      profile: {
        id: context.profile.id,
        full_name: context.profile.full_name,
        email: context.profile.email,
        phone: context.profile.phone,
        default_role: context.profile.default_role,
        organization_id: context.profile.organization_id,
      },
      roles: context.roles,
      primaryRole: context.primaryRole,
      organizationId: context.organizationId,
      hostelIds: context.hostelIds,
      onboardingRequired: !context.organizationId,
      redirectTo: context.organizationId
        ? this.resolveRedirectPath(context.roles)
        : AUTH_REDIRECTS.onboarding,
    }
  }

  private resolveRedirectPath(roles: AppRole[]) {
    if (roles.some((role) => (ADMIN_PORTAL_ROLES as readonly AppRole[]).includes(role))) {
      return AUTH_REDIRECTS.adminHome
    }

    if (roles.includes("resident")) {
      return AUTH_REDIRECTS.residentHome
    }

    return AUTH_REDIRECTS.login
  }
}

function getAccountStatus(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "active"
  }

  const status = (metadata as Record<string, unknown>).account_status

  return typeof status === "string" ? status : "active"
}

export function assertFound<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw notFound(message)
  }

  return value
}
