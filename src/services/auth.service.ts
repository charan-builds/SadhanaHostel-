import "server-only"

import type { User } from "@supabase/supabase-js"
import { headers } from "next/headers"

import {
  ADMIN_PORTAL_ROLES,
  ADMIN_ROLES,
  AUTH_REDIRECTS,
  RESIDENT_ROLES,
  anyRoleHasPermission,
  type AppRole,
  type PermissionKey,
} from "@/constants/auth"
import { getServerEnv } from "@/config/env"
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
  phoneNumbersMatch,
  phoneLastTen,
  tryNormalizePhoneNumber,
} from "@/lib/identity"
import { logger } from "@/lib/logger"
import {
  buildResidentInternalAuthEmail,
  getResidentMetadataAuthLoginEmail,
  normalizeEmailCandidate,
  resolveResidentAuthLoginEmail,
  resolveResidentInternalAuthEmail,
} from "@/lib/resident-auth-identity"
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

type ResidentAuthIdentityRepairDb = {
  rpc(
    functionName: "repair_resident_auth_identity_atomic",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string; code?: string } | null }>
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
    let {
      data: { user },
      error,
    } = await this.db.auth.getUser()

    if (error || !user) {
      const bearerToken = await getBearerTokenFromRequest()

      if (bearerToken) {
        const fallback = await this.db.auth.getUser(bearerToken)
        user = fallback.data.user
        error = fallback.error
      }
    }

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
    const tenantScope = await this.resolveTenantScope({
      profile,
      roleAssignments,
      roles,
    })
    const organizationId = tenantScope.organizationId
    let hostelIds = tenantScope.hostelIds

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

  async requirePermission(permission: PermissionKey) {
    const context = await this.getCurrentContext()

    if (!anyRoleHasPermission(context.roles, permission)) {
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

      if (!resident) {
        return null
      }

      const linkedAuthUser = resident.user_id
        ? await getAuthUserById(adminDb, resident.user_id)
        : null
      const authUser = linkedAuthUser ?? await this.findAuthUserForResidentIdentity(
        adminDb,
        resident
      )

      if (!resident.user_id && !authUser) {
        return null
      }

      const canonicalLoginEmail = getCanonicalResidentPasswordLoginEmail(resident)
      const profile = resident.user_id
        ? await new UsersRepository(adminDb).getById(resident.user_id)
        : null
      const profileMetadata = recordFromUnknown(profile?.metadata)
      const profileLoginEmail = getResidentMetadataAuthLoginEmail(profileMetadata)

      if (profileLoginEmail && profileLoginEmail === canonicalLoginEmail) {
        logPhonePasswordResolution({
          normalizedPhone,
          resident,
          strategy: "public_user_metadata",
          authLoginEmail: profileLoginEmail,
        })

        return profileLoginEmail
      }

      const profileEmail = normalizeEmailCandidate(profile?.email)

      if (profileEmail && profileEmail === canonicalLoginEmail) {
        logPhonePasswordResolution({
          normalizedPhone,
          resident,
          strategy: "public_user_email",
          authLoginEmail: profileEmail,
        })

        return profileEmail
      }

      const authLoginEmail = authUser ? canonicalLoginEmail : null

      if (authUser && authLoginEmail) {
        await this.repairResidentPasswordIdentity({
          adminDb,
          resident,
          profile,
          authUser,
          authLoginEmail,
          normalizedPhone,
          reason: resident.user_id
            ? "login_alias_metadata_missing"
            : "login_resident_link_missing",
        })

        logPhonePasswordResolution({
          normalizedPhone,
          resident,
          strategy: resident.user_id ? "auth_identity_repair" : "auth_identity_link_repair",
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

  private async findAuthUserForResidentIdentity(
    adminDb: AppSupabaseClient,
    resident: ResidentLoginDiagnosticRow
  ) {
    const authAdmin = getAuthAdminApi(adminDb)

    if (!authAdmin?.listUsers) {
      return null
    }

    const residentEmail = normalizeEmailCandidate(resident.email)
    const residentPhone = tryNormalizePhoneNumber(resident.phone ?? "")
    const residentInternalEmail = buildResidentInternalAuthEmail(resident.id)
    const matches: User[] = []

    for (let page = 1; page <= 50; page += 1) {
      const { data, error } = await authAdmin.listUsers({
        page,
        perPage: 100,
      })

      if (error) {
        logger.warn({
          event: "auth.resident_identity_candidate_lookup_failed",
          message: "Could not inspect Supabase auth users while repairing resident phone login.",
          organizationId: resident.organization_id,
          userId: resident.user_id,
          metadata: {
            residentId: resident.id,
            error: error.message,
          },
        })

        return null
      }

      for (const candidate of data.users) {
        if (authUserMatchesResident(candidate, resident, {
          residentEmail,
          residentPhone,
          residentInternalEmail,
        })) {
          matches.push(candidate)
        }
      }

      if (data.users.length < 100) {
        break
      }
    }

    const uniqueMatches = [...new Map(matches.map((user) => [user.id, user])).values()]

    if (uniqueMatches.length === 1) {
      return uniqueMatches[0]
    }

    if (uniqueMatches.length > 1) {
      logger.warn({
        event: "auth.resident_identity_candidate_ambiguous",
        message: "Multiple Supabase auth users match one resident phone login; repair was skipped.",
        organizationId: resident.organization_id,
        metadata: {
          residentId: resident.id,
          candidateUserIds: uniqueMatches.map((user) => user.id),
          normalizedPhone: residentPhone,
        },
      })
    }

    return null
  }

  private async repairResidentPasswordIdentity(input: {
    adminDb: AppSupabaseClient
    resident: ResidentLoginDiagnosticRow
    profile: UserRow | null
    authUser: User
    authLoginEmail: string
    normalizedPhone: string
    reason: "login_alias_metadata_missing" | "login_resident_link_missing"
  }) {
    const authMetadata = recordFromUnknown(input.authUser.user_metadata)
    const profileMetadata = recordFromUnknown(input.profile?.metadata)
    const internalAuthEmail = resolveResidentInternalAuthEmail({
      residentId: input.resident.id,
      profileMetadata,
      authMetadata,
      profileEmail: input.profile?.email,
      authEmail: input.authUser.email,
      residentEmail: input.resident.email,
    })
    const userMetadata = {
      ...authMetadata,
      organization_id: input.resident.organization_id,
      hostel_id: input.resident.hostel_id,
      resident_id: input.resident.id,
      auth_login_email: input.authLoginEmail,
      internal_auth_email: internalAuthEmail ?? undefined,
      resident_identity_mode: inferResidentIdentityMode(input.resident),
      phone_password_login_strategy: internalAuthEmail
        ? "internal_email_alias"
        : "direct_email",
      resident_auth_identity_version: 2,
      resident_auth_repaired_at: new Date().toISOString(),
      resident_auth_repair_reason: input.reason,
    }
    const updatePayload: {
      email?: string
      email_confirm?: boolean
      phone?: string
      phone_confirm?: boolean
      user_metadata: Record<string, unknown>
    } = {
      user_metadata: userMetadata,
    }
    const authEmail = normalizeEmailCandidate(input.authUser.email)

    if (!authEmail || authEmail !== input.authLoginEmail) {
      updatePayload.email = input.authLoginEmail
      updatePayload.email_confirm = true
    }

    if (!input.authUser.phone && input.normalizedPhone) {
      updatePayload.phone = input.normalizedPhone
      updatePayload.phone_confirm = true
    }

    const authAdmin = getAuthAdminApi(input.adminDb)

    if (!authAdmin?.updateUserById) {
      return
    }

    const { data: updatedAuth, error: updateError } = await authAdmin.updateUserById(
      input.authUser.id,
      updatePayload
    )

    if (updateError || !updatedAuth.user) {
      logger.warn({
        event: "auth.resident_password_identity_auth_repair_failed",
        message: "Could not repair Supabase auth metadata before resident phone login.",
        organizationId: input.resident.organization_id,
        userId: input.authUser.id,
        metadata: {
          residentId: input.resident.id,
          error: updateError?.message,
          reason: input.reason,
        },
      })

      return
    }

    const { error } = await (input.adminDb as unknown as ResidentAuthIdentityRepairDb).rpc(
      "repair_resident_auth_identity_atomic",
      {
        p_organization_id: input.resident.organization_id,
        p_resident_id: input.resident.id,
        p_auth_user_id: updatedAuth.user.id,
        p_auth_login_email: input.authLoginEmail,
        p_internal_auth_email: internalAuthEmail,
        p_reason: input.reason,
      }
    )

    if (error) {
      logger.warn({
        event: "auth.resident_password_identity_profile_repair_failed",
        message: "Could not repair public resident auth linkage before phone login.",
        organizationId: input.resident.organization_id,
        userId: updatedAuth.user.id,
        metadata: {
          residentId: input.resident.id,
          error: error.message,
          code: error.code,
          reason: input.reason,
        },
      })

      return
    }

    logger.info({
      event: "auth.resident_password_identity_repaired",
      message: "Resident password login identity was repaired before provider sign-in.",
      organizationId: input.resident.organization_id,
      userId: updatedAuth.user.id,
      metadata: {
        residentId: input.resident.id,
        hostelId: input.resident.hostel_id,
        authLoginEmail: maskEmail(input.authLoginEmail),
        normalizedPhone: input.normalizedPhone,
        reason: input.reason,
      },
    })
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
    const redirectTo = values.redirectTo
      ? this.requireAllowedPasswordResetRedirect(values.redirectTo)
      : undefined
    const { error } = await this.db.auth.resetPasswordForEmail(values.email, {
      redirectTo,
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
    const activeAssignments = roleAssignments.filter(
      (assignment) => assignment.status === "active"
    )

    if (activeAssignments.length === 0 || profile.default_role === "resident" || profile.default_role === "parent") {
      roles.add(profile.default_role)
    }

    activeAssignments.forEach((assignment) => {
      roles.add(assignment.role)
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

  private async resolveTenantScope(input: {
    profile: UserRow
    roleAssignments: UserRoleRow[]
    roles: AppRole[]
  }) {
    const defaultTenant = getDefaultTenantFromEnv()
    const isAdminPortalUser = input.roles.some((role) =>
      (ADMIN_PORTAL_ROLES as readonly AppRole[]).includes(role)
    )
    const organizationId =
      input.profile.organization_id ??
      input.roleAssignments[0]?.organization_id ??
      (isAdminPortalUser ? defaultTenant.organizationId : null) ??
      (isAdminPortalUser ? await this.resolveOnlyActiveOrganizationId() : null)
    let hostelIds = [
      ...new Set(input.roleAssignments.map((role) => role.hostel_id).filter(Boolean)),
    ] as string[]

    if (
      organizationId &&
      hostelIds.length === 0 &&
      isAdminPortalUser &&
      defaultTenant.hostelId
    ) {
      hostelIds = [defaultTenant.hostelId]
    }

    if (organizationId && input.profile.organization_id !== organizationId) {
      const { error } = await createSupabaseAdminClient()
        .from("users")
        .update({ organization_id: organizationId })
        .eq("id", input.profile.id)

      if (error) {
        logger.warn({
          event: "auth.single_tenant_profile_cache_failed",
          message: "Resolved single-tenant organization context but could not cache it on the user profile.",
          organizationId,
          userId: input.profile.id,
          metadata: {
            error: error.message,
          },
        })
      }

      input.profile.organization_id = organizationId
    }

    return {
      organizationId,
      hostelIds,
    }
  }

  private async resolveOnlyActiveOrganizationId() {
    const organizations = await this.organizationsRepository.listActiveOrganizations()

    return organizations.length === 1 ? organizations[0].id : null
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

    if (
      metadata.temporary_password_active !== true &&
      metadata.force_password_reset !== true
    ) {
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
        const profileMetadata = recordFromUnknown(profile.metadata)
        const profileLoginEmail =
          getResidentMetadataAuthLoginEmail(profileMetadata) ??
          normalizeEmailCandidate(profile.email)
        const authUser = await getAuthUserById(adminDb, resident.user_id)
        const authMetadata = recordFromUnknown(authUser?.user_metadata)
        const authLoginEmail = authUser
          ? resolveResidentAuthLoginEmail({
              residentId: resident.id,
              profileMetadata,
              authMetadata,
              profileEmail: profile.email,
              authEmail: authUser.email,
              residentEmail: resident.email,
            })
          : null

        if (profileLoginEmail || authLoginEmail) {
          return null
        }

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

  private requireAllowedPasswordResetRedirect(redirectTo: string) {
    const appUrl = new URL(getServerEnv().NEXT_PUBLIC_APP_URL)
    const redirectUrl = new URL(redirectTo)
    const allowedPaths = new Set([
      AUTH_REDIRECTS.login,
      AUTH_REDIRECTS.unauthorized,
      "/forgot-password",
    ])

    if (
      redirectUrl.origin !== appUrl.origin ||
      !allowedPaths.has(redirectUrl.pathname)
    ) {
      throw badRequest("Password reset redirect URL is not allowed.")
    }

    return redirectUrl.toString()
  }
}

async function getBearerTokenFromRequest() {
  const authorization = (await headers()).get("authorization")
  const [scheme, token] = authorization?.split(" ") ?? []

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null
  }

  return token
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

function getDefaultTenantFromEnv() {
  const env = getServerEnv()

  return {
    organizationId: env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? null,
    hostelId: env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID ?? null,
  }
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

function getAuthAdminApi(adminDb: AppSupabaseClient) {
  return (
    adminDb as unknown as {
      auth?: {
        admin?: {
          getUserById?: (userId: string) => Promise<{
            data: { user: User | null }
            error: { message: string; code?: string } | null
          }>
          listUsers?: (options: { page: number; perPage: number }) => Promise<{
            data: { users: User[] }
            error: { message: string; code?: string } | null
          }>
          updateUserById?: (
            userId: string,
            payload: {
              email?: string
              email_confirm?: boolean
              phone?: string
              phone_confirm?: boolean
              user_metadata?: Record<string, unknown>
            }
          ) => Promise<{
            data: { user: User | null }
            error: { message: string; code?: string } | null
          }>
        }
      }
    }
  ).auth?.admin
}

function authUserMatchesResident(
  user: User,
  resident: ResidentLoginDiagnosticRow,
  normalized: {
    residentEmail: string | null
    residentPhone: string | null
    residentInternalEmail: string
  }
) {
  const metadata = recordFromUnknown(user.user_metadata)
  const metadataOrganizationId = stringFromMetadataRecord(metadata, "organization_id")
  const metadataResidentId = stringFromMetadataRecord(metadata, "resident_id")
  const userEmail = normalizeEmailCandidate(user.email)
  const metadataLoginEmail = getResidentMetadataAuthLoginEmail(metadata)

  if (metadataOrganizationId && metadataOrganizationId !== resident.organization_id) {
    return false
  }

  return Boolean(
    user.id === resident.user_id ||
      metadataResidentId === resident.id ||
      userEmail === normalized.residentInternalEmail ||
      metadataLoginEmail === normalized.residentInternalEmail ||
      (normalized.residentEmail && userEmail === normalized.residentEmail) ||
      (normalized.residentEmail && metadataLoginEmail === normalized.residentEmail) ||
      (normalized.residentPhone && phoneNumbersMatch(user.phone, normalized.residentPhone))
  )
}

function inferResidentIdentityMode(resident: ResidentLoginDiagnosticRow) {
  if (resident.email && resident.phone) {
    return "email_and_phone"
  }

  return resident.email ? "email" : "phone"
}

function getCanonicalResidentPasswordLoginEmail(resident: ResidentLoginDiagnosticRow) {
  return normalizeEmailCandidate(resident.email) ?? buildResidentInternalAuthEmail(resident.id)
}

function stringFromMetadataRecord(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]

  return typeof value === "string" ? value : null
}

async function getAuthUserById(adminDb: AppSupabaseClient, userId: string) {
  const authAdmin = getAuthAdminApi(adminDb)

  if (!authAdmin?.getUserById) {
    return null
  }

  const { data, error } = await authAdmin.getUserById(userId)

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
    | "auth_identity_repair"
    | "auth_identity_link_repair"
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
