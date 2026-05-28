import "server-only"

import type { User } from "@supabase/supabase-js"

import { ADMIN_PORTAL_ROLES, ADMIN_ROLES, AUTH_REDIRECTS, RESIDENT_ROLES, type AppRole } from "@/constants/auth"
import {
  badRequest,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api/api-error"
import { AppError } from "@/lib/errors"
import {
  PhoneNormalizationError,
  normalizePhoneNumber,
  phoneLastTen,
  tryNormalizePhoneNumber,
} from "@/lib/identity"
import { logger } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OrganizationsRepository } from "@/repositories/organizations.repository"
import {
  ResidentsRepository,
  type ResidentWithOnboarding,
} from "@/repositories/residents.repository"
import { ResidentInvitesRepository } from "@/repositories/resident-invites.repository"
import { UsersRepository, type UserRoleRow, type UserRow } from "@/repositories/users.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { maskEmail, maskPhone } from "@/lib/security"
import { getResidentOnboardingRequirements } from "@/services/onboarding/resident-onboarding.policy"
import {
  adminOnboardingSchema,
  loginSchema,
  residentOnboardingSchema,
  requestResidentPhoneOtpSchema,
  resetPasswordSchema,
  verifyResidentPhoneOtpSchema,
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

type ResidentLoginDiagnosticRow = {
  id: string
  organization_id: string
  hostel_id: string
  user_id: string | null
  status: string | null
  onboarding_status: string | null
  is_active: boolean | null
  email: string | null
  phone: string | null
}

export class AuthService {
  private readonly usersRepository: UsersRepository
  private readonly organizationsRepository: OrganizationsRepository
  private readonly residentsRepository: ResidentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.usersRepository = new UsersRepository(db)
    this.organizationsRepository = new OrganizationsRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
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
    const passwordCredentials = await this.buildPasswordCredentialsForLogin(
      identifier,
      values.password
    )

    logAuthProviderPayload("password_login", {
      rawIdentifier: identifier,
      normalizedEmail: "email" in passwordCredentials ? passwordCredentials.email : undefined,
      normalizedPhone: "phone" in passwordCredentials ? passwordCredentials.phone : undefined,
      payload: passwordCredentials,
    })

    const { error } = await this.db.auth.signInWithPassword({
      ...passwordCredentials,
    })

    if (error) {
      logger.warn({
        event: "auth.password_login_failed",
        message: "Supabase password login rejected the resolved resident identity.",
        metadata: {
          rawIdentifier: maskLoginIdentifier(identifier),
          credentialMode: "email" in passwordCredentials ? "email" : "phone",
          normalizedPhone: "phone" in passwordCredentials ? passwordCredentials.phone : undefined,
          normalizedEmail: "email" in passwordCredentials ? maskEmail(passwordCredentials.email) : undefined,
          supabaseError: {
            message: error.message,
            status: "status" in error ? error.status : undefined,
            code: "code" in error ? error.code : undefined,
          },
        },
      })

      const residentStateError = await this.classifyResidentLoginFailure(identifier)

      if (residentStateError) {
        throw residentStateError
      }

      throw unauthorized("Invalid phone/email or password.")
    }

    const context = await this.getCurrentContext()

    await this.assertTemporaryPasswordIsUsable(context)

    return this.toSessionOverview(context)
  }

  private async buildPasswordCredentialsForLogin(identifier: string, password: string) {
    const credentials = buildPasswordCredentials(identifier, password)

    if ("email" in credentials) {
      return credentials
    }

    const resolvedEmail = await this.resolveResidentPhonePasswordLoginEmail(
      credentials.phone
    )

    if (!resolvedEmail) {
      return credentials
    }

    return {
      email: resolvedEmail,
      password,
    }
  }

  private async resolveResidentPhonePasswordLoginEmail(normalizedPhone: string) {
    try {
      const adminDb = createSupabaseAdminClient()
      const resident = await this.findResidentForLoginDiagnostics(adminDb, normalizedPhone)

      if (!resident?.user_id) {
        return null
      }

      const profile = await new UsersRepository(adminDb).getById(resident.user_id)
      const profileMetadata = recordFromUnknown(profile?.metadata)
      const profileLoginEmail = getInternalAuthLoginEmail(profileMetadata)

      if (profileLoginEmail) {
        logPhonePasswordResolution({
          normalizedPhone,
          resident,
          strategy: "public_user_metadata",
          authLoginEmail: profileLoginEmail,
        })

        return profileLoginEmail
      }

      const profileEmail = normalizeEmailCandidate(profile?.email)

      if (profileEmail) {
        logPhonePasswordResolution({
          normalizedPhone,
          resident,
          strategy: "public_user_email",
          authLoginEmail: profileEmail,
        })

        return profileEmail
      }

      const authUser = await getAuthUserById(adminDb, resident.user_id)
      const authMetadata = recordFromUnknown(authUser?.user_metadata)
      const authLoginEmail =
        getInternalAuthLoginEmail(authMetadata) ?? normalizeEmailCandidate(authUser?.email)

      if (authLoginEmail) {
        logPhonePasswordResolution({
          normalizedPhone,
          resident,
          strategy: "auth_user_metadata",
          authLoginEmail,
        })

        return authLoginEmail
      }

      logPhonePasswordResolution({
        normalizedPhone,
        resident,
        strategy: "phone_provider_fallback",
        authLoginEmail: null,
      })

      return null
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logger.warn({
        event: "auth.phone_password_resolution_failed",
        message: "Phone-first password login could not resolve a resident auth alias.",
        metadata: {
          normalizedPhone,
          error: error instanceof Error ? error.message : String(error),
        },
      })

      return null
    }
  }

  async requestResidentPhoneOtp(input: unknown) {
    const values = requestResidentPhoneOtpSchema.parse(input)
    const phone = normalizePhoneNumber(values.phone)

    logAuthProviderPayload("resident_otp_request", {
      rawIdentifier: values.phone,
      normalizedPhone: phone,
      payload: {
        phone,
        options: { shouldCreateUser: false },
      },
    })

    const { error } = await this.db.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      throw unauthorized(
        "We could not send an OTP for this phone. Ask the hostel office to resend your activation link or temporary password."
      )
    }

    return {
      phone: maskPhone(phone) ?? "your phone",
      expiresInSeconds: 300,
    }
  }

  async verifyResidentPhoneOtp(input: unknown): Promise<SessionOverview> {
    const values = verifyResidentPhoneOtpSchema.parse(input)
    const phone = normalizePhoneNumber(values.phone)

    logAuthProviderPayload("resident_otp_verify", {
      rawIdentifier: values.phone,
      normalizedPhone: phone,
      payload: {
        phone,
        token: "REDACTED",
        type: "sms",
      },
    })

    const { error } = await this.db.auth.verifyOtp({
      phone,
      token: values.token,
      type: "sms",
    })

    if (error) {
      throw unauthorized("Invalid or expired OTP. Request a fresh code and try again.")
    }

    const context = await this.getCurrentContext()

    if (!context.roles.some((role) => (RESIDENT_ROLES as readonly AppRole[]).includes(role))) {
      await this.db.auth.signOut()
      throw forbidden("This phone number is not assigned to resident portal access.")
    }

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

    if (context.roles.includes("super_admin")) {
      return
    }

    if (!hostelId) {
      if (this.hasOrganizationWideAccess(context, organizationId)) {
        return
      }

      throw forbidden("Your account is not assigned organization-wide access.")
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

  resolveHostelScope(
    context: AuthContext,
    organizationId: string,
    requestedHostelId?: string | null
  ) {
    this.requireOrganizationAccess(context, organizationId)

    if (requestedHostelId) {
      this.requireHostelAccess(context, organizationId, requestedHostelId)
      return requestedHostelId
    }

    if (this.hasOrganizationWideAccess(context, organizationId)) {
      return null
    }

    const scopedHostelId = context.hostelIds[0]

    if (!scopedHostelId) {
      throw forbidden("Your account is not assigned to a hostel.")
    }

    this.requireHostelAccess(context, organizationId, scopedHostelId)
    return scopedHostelId
  }

  async onboardResident(input: unknown) {
    const values = residentOnboardingSchema.parse(input)
    const context = await this.requireAdmin()
    const { data: resident, error: residentError } = await this.db
      .from("residents")
      .select("organization_id, hostel_id")
      .eq("id", values.residentId)
      .is("deleted_at", null)
      .maybeSingle()

    if (residentError) {
      throw forbidden("Unable to validate resident tenant scope.")
    }

    if (!resident) {
      throw notFound("Resident not found.")
    }

    this.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

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
    const targetHostelId = this.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )


    if (!(ADMIN_ROLES as readonly AppRole[]).includes(values.role)) {
      throw forbidden("Only owner/admin roles can be onboarded through this workflow.")
    }

    const adminDb = createSupabaseAdminClient()
    const { data, error } = await adminDb.rpc("onboard_admin", {
      target_user_id: values.userId,
      target_organization_id: values.organizationId,
      target_hostel_id: targetHostelId ?? undefined,
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

  private hasOrganizationWideAccess(context: AuthContext, organizationId: string) {
    if (context.roles.includes("super_admin")) {
      return true
    }

    const hasOrganizationWideAssignment = context.roleAssignments.some(
      (assignment) =>
        assignment.organization_id === organizationId &&
        assignment.status === "active" &&
        !assignment.hostel_id
    )

    if (hasOrganizationWideAssignment) {
      return true
    }

    const hasOrganizationRoleAssignments = context.roleAssignments.some(
      (assignment) => assignment.organization_id === organizationId
    )

    return (
      !hasOrganizationRoleAssignments &&
      context.profile.organization_id === organizationId &&
      (context.primaryRole === "owner" || context.primaryRole === "admin")
    )
  }

  private async toSessionOverview(context: AuthContext): Promise<SessionOverview> {
    const residentSession = await this.resolveResidentSessionState(context)
    const onboardingRequired = !context.organizationId || residentSession.onboardingRequired
    const redirectTo = !context.organizationId
      ? AUTH_REDIRECTS.onboarding
      : residentSession.redirectTo ?? this.resolveRedirectPath(context.roles)

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
      onboardingRequired,
      redirectTo,
    }
  }

  private async resolveResidentSessionState(context: AuthContext) {
    const isResidentOnlySession =
      context.roles.includes("resident") &&
      !context.roles.some((role) =>
        (ADMIN_PORTAL_ROLES as readonly AppRole[]).includes(role)
      )

    if (!isResidentOnlySession || !context.organizationId) {
      return {
        onboardingRequired: false,
        redirectTo: null as string | null,
      }
    }

    const resident = await this.residentsRepository.getByUserId(
      context.authUser.id,
      context.organizationId
    )

    if (!resident) {
      return {
        onboardingRequired: true,
        redirectTo: AUTH_REDIRECTS.residentOnboarding,
      }
    }

    const requirements = getResidentOnboardingRequirements(
      resident as ResidentWithOnboarding
    )

    if (!requirements.canAccessResidentOperations) {
      return {
        onboardingRequired: true,
        redirectTo: AUTH_REDIRECTS.residentOnboarding,
      }
    }

    return {
      onboardingRequired: false,
      redirectTo: null as string | null,
    }
  }

  private async assertTemporaryPasswordIsUsable(context: AuthContext) {
    const metadata = recordFromUnknown(context.profile.metadata)

    if (metadata.temporary_password_active !== true) {
      return
    }

    const expiresAt = typeof metadata.temporary_password_expires_at === "string"
      ? Date.parse(metadata.temporary_password_expires_at)
      : Number.NaN

    if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) {
      return
    }

    await this.db.auth.signOut()

    throw unauthorized(
      "This temporary password has expired. Ask hostel administration to resend resident access."
    )
  }

  private async classifyResidentLoginFailure(identifier: string) {
    try {
      const adminDb = createSupabaseAdminClient()
      const resident = await this.findResidentForLoginDiagnostics(adminDb, identifier)

      if (!resident) {
        return null
      }

      if (
        resident.is_active === false ||
        resident.status === "suspended" ||
        resident.onboarding_status === "suspended"
      ) {
        return unauthorized(
          "Your resident portal access is suspended. Contact hostel administration for reactivation."
        )
      }

      if (!resident.user_id) {
        const invitesRepository = new ResidentInvitesRepository(adminDb)
        const activeInvite = await invitesRepository.findActiveByResident(
          resident.organization_id,
          resident.id
        )

        if (activeInvite) {
          return unauthorized(
            "Activation is pending. Open the latest WhatsApp activation link or ask the hostel office to resend access."
          )
        }

        const recentInvites = await invitesRepository.listForResident(
          resident.organization_id,
          resident.id
        )
        const newestInvite = recentInvites[0]

        if (
          newestInvite &&
          (newestInvite.status === "expired" ||
            new Date(newestInvite.expires_at).getTime() <= Date.now())
        ) {
          return unauthorized(
            "Your activation invite has expired. Ask hostel administration to resend resident access."
          )
        }

        return unauthorized(
          "Portal access is not activated yet. Ask hostel administration to send your activation link or temporary password."
        )
      }

      const profile = await new UsersRepository(adminDb).getById(resident.user_id)

      if (!profile) {
        return unauthorized(
          "Resident login is linked but profile synchronization is incomplete. Ask hostel administration to run auth linkage repair."
        )
      }

      const metadata = recordFromUnknown(profile.metadata)

      if (metadata.temporary_password_active === true) {
        const expiresAt = typeof metadata.temporary_password_expires_at === "string"
          ? Date.parse(metadata.temporary_password_expires_at)
          : Number.NaN

        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
          return unauthorized(
            "This temporary password has expired. Ask hostel administration to resend resident access."
          )
        }
      }

      if (!identifier.includes("@")) {
        return unauthorized(
          "Phone login could not be completed because resident password access is not synchronized. Ask hostel administration to reset resident access or run auth linkage repair."
        )
      }

      return null
    } catch (error) {
      if (error instanceof AppError) {
        return error
      }

      return null
    }
  }

  private async findResidentForLoginDiagnostics(
    adminDb: AppSupabaseClient,
    identifier: string
  ) {
    const trimmed = identifier.trim()

    if (!trimmed) {
      return null
    }

    let query = adminDb
      .from("residents")
      .select("id,organization_id,hostel_id,user_id,status,onboarding_status,is_active,email,phone")
      .is("deleted_at", null)
      .limit(2)

    if (trimmed.includes("@")) {
      query = query.eq("email", trimmed.toLowerCase())
    } else {
      const normalizedPhone = tryNormalizePhoneNumber(trimmed)
      const digits = trimmed.replace(/\D/g, "")
      const lastTen = phoneLastTen(trimmed) ?? digits.slice(-10)
      const filters = [
        normalizedPhone ? `phone.eq.${normalizedPhone}` : null,
        digits ? `phone.eq.${digits}` : null,
        lastTen ? `phone.ilike.%${lastTen}%` : null,
      ]
        .filter(Boolean)
        .join(",")

      query = query.or(filters)
    }

    const { data, error } = await query

    const rows = (data ?? []) as unknown as ResidentLoginDiagnosticRow[]

    if (error || rows.length === 0) {
      return null
    }

    if (rows.length > 1) {
      const linkedRows = rows.filter((row) => Boolean(row.user_id))

      if (linkedRows.length === 1) {
        logger.warn({
          event: "auth.phone_duplicate_resolved_to_linked_resident",
          message: "Multiple resident rows matched login; using the only auth-linked resident.",
          organizationId: linkedRows[0].organization_id,
          userId: linkedRows[0].user_id,
          metadata: {
            selectedResidentId: linkedRows[0].id,
            duplicateResidentIds: rows.map((row) => row.id),
          },
        })

        return linkedRows[0]
      }

      throw unauthorized(
        "Multiple resident records match this login. Ask hostel administration to merge duplicates before signing in."
      )
    }

    return rows[0]
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
  const status = recordFromUnknown(metadata).account_status

  return typeof status === "string" ? status : "active"
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function buildPasswordCredentials(identifier: string, password: string) {
  const trimmed = identifier.trim()

  if (trimmed.includes("@")) {
    return {
      email: trimmed.toLowerCase(),
      password,
    }
  }

  return {
    phone: normalizePhoneForUserInput(trimmed),
    password,
  }
}

function normalizePhoneForUserInput(value: string) {
  try {
    return normalizePhoneNumber(value)
  } catch (error) {
    if (error instanceof PhoneNormalizationError) {
      throw badRequest(error.message)
    }

    throw error
  }
}

function normalizeEmailCandidate(value: string | null | undefined) {
  const email = value?.trim().toLowerCase()

  return email && email.includes("@") ? email : null
}

function getInternalAuthLoginEmail(metadata: Record<string, unknown>) {
  return (
    normalizeEmailCandidate(stringFromMetadata(metadata, "auth_login_email")) ??
    normalizeEmailCandidate(stringFromMetadata(metadata, "internal_auth_email"))
  )
}

function stringFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]

  return typeof value === "string" ? value : null
}

async function getAuthUserById(adminDb: AppSupabaseClient, userId: string) {
  const { data, error } = await adminDb.auth.admin.getUserById(userId)

  if (error) {
    logger.warn({
      event: "auth.phone_password_auth_lookup_failed",
      message: "Could not inspect Supabase auth user while resolving phone-first password login.",
      userId,
      metadata: {
        error: error.message,
      },
    })

    return null
  }

  return data.user
}

function logPhonePasswordResolution(input: {
  normalizedPhone: string
  resident: ResidentLoginDiagnosticRow
  strategy:
    | "public_user_metadata"
    | "public_user_email"
    | "auth_user_metadata"
    | "phone_provider_fallback"
  authLoginEmail: string | null
}) {
  logger.info({
    event: "auth.phone_password_resolution",
    message: "Phone-first resident password login resolved provider credentials.",
    organizationId: input.resident.organization_id,
    userId: input.resident.user_id,
    metadata: {
      residentId: input.resident.id,
      hostelId: input.resident.hostel_id,
      normalizedPhone: input.normalizedPhone,
      strategy: input.strategy,
      authLoginEmail: maskEmail(input.authLoginEmail),
      residentStatus: input.resident.status,
      onboardingStatus: input.resident.onboarding_status,
    },
  })
}

function maskLoginIdentifier(identifier: string) {
  return identifier.includes("@") ? maskEmail(identifier) : maskPhone(identifier)
}

function logAuthProviderPayload(
  mode: "password_login" | "resident_otp_request" | "resident_otp_verify",
  input: {
    rawIdentifier?: string | null
    normalizedEmail?: string
    normalizedPhone?: string
    payload: Record<string, unknown>
  }
) {
  logger.info({
    event: "auth.identity_payload",
    message: "Auth provider identity payload prepared.",
    metadata: {
      mode,
      rawPhone: input.rawIdentifier?.includes("@") ? undefined : maskPhone(input.rawIdentifier),
      rawEmail: input.rawIdentifier?.includes("@") ? maskEmail(input.rawIdentifier) : undefined,
      normalizedPhone: input.normalizedPhone,
      normalizedEmail: input.normalizedEmail,
      providerPayload: sanitizeAuthProviderPayload(input.payload),
    },
  })
}

function sanitizeAuthProviderPayload(payload: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (key === "password" || key === "token") {
      sanitized[key] = "REDACTED"
    } else if (key === "email") {
      sanitized[key] = typeof value === "string" ? maskEmail(value) : value
    } else if (key === "phone") {
      sanitized[key] = typeof value === "string" ? maskPhone(value) : value
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export function assertFound<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw notFound(message)
  }

  return value
}
