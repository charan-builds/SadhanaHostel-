import "server-only"

import type { User } from "@supabase/supabase-js"

import { ADMIN_PORTAL_ROLES, type AppRole } from "@/constants/auth"
import { badRequest, forbidden } from "@/lib/api/api-error"
import { normalizeOptionalPhoneNumber } from "@/lib/identity"
import { logger } from "@/lib/logger"
import {
  getResidentMetadataAuthLoginEmail,
  normalizeEmailCandidate,
  resolveResidentAuthLoginEmail,
} from "@/lib/resident-auth-identity"
import { maskEmail, maskPhone } from "@/lib/security"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/repositories/types"
import { AuthService } from "@/services/auth.service"
import type {
  DemoDataResetAuthUser,
  DemoDataResetReport,
  IdentityReconciliationFinding,
  IdentityReconciliationReport,
  IdentityRepairResult,
} from "@/types/operations"
import type { Json, Tables } from "@/types/database"
import {
  identityReconciliationQuerySchema,
  identityRepairSchema,
} from "@/validations/operations.validation"

type ResidentIdentityRow = Pick<
  Tables<"residents">,
  | "id"
  | "organization_id"
  | "hostel_id"
  | "user_id"
  | "full_name"
  | "email"
  | "phone"
  | "status"
  | "is_active"
  | "deleted_at"
> & {
  onboarding_status?: string | null
}

type PublicUserIdentityRow = Pick<
  Tables<"users">,
  | "id"
  | "organization_id"
  | "email"
  | "phone"
  | "default_role"
  | "is_platform_user"
  | "is_active"
  | "metadata"
  | "deleted_at"
>

type UserRoleIdentityRow = Pick<
  Tables<"user_roles">,
  "user_id" | "organization_id" | "hostel_id" | "role" | "status" | "deleted_at"
>

type IdentitySnapshot = {
  authUsers: User[]
  residents: ResidentIdentityRow[]
  publicUsers: PublicUserIdentityRow[]
  roles: UserRoleIdentityRow[]
}

type AuthDeletionDecision = {
  safe: boolean
  reason: string
  blocker?: string
}

type ResetAuthCleanupPlan = {
  authUsers: DemoDataResetAuthUser[]
  warnings: string[]
}

const RESIDENT_SAFE_ROLES = new Set<AppRole>(["resident", "parent"])

export class IdentityReconciliationService {
  constructor(
    private readonly authService: AuthService,
    private readonly adminDb = createSupabaseAdminClient()
  ) {}

  static async create() {
    const db = await createSupabaseServerClient()

    return new IdentityReconciliationService(new AuthService(db))
  }

  async scan(input: unknown): Promise<IdentityReconciliationReport> {
    const values = identityReconciliationQuerySchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")
    const organizationId = values.organizationId ?? context.organizationId

    if (!organizationId) {
      throw badRequest("Organization scope is required for identity repair.")
    }

    this.authService.requireHostelAccess(context, organizationId, values.hostelId)

    return this.scanTrusted({
      organizationId,
      hostelId: values.hostelId ?? null,
    })
  }

  async repair(input: unknown): Promise<IdentityRepairResult> {
    const values = identityRepairSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    this.authService.requireHostelAccess(
      context,
      values.organizationId,
      values.hostelId
    )

    if (
      !values.dryRun &&
      !context.roles.some((role) => role === "owner" || role === "super_admin")
    ) {
      throw forbidden("Only owners can delete orphan resident auth identities.")
    }

    const report = await this.scanTrusted({
      organizationId: values.organizationId,
      hostelId: values.hostelId ?? null,
    })
    const warnings: string[] = []
    let deletedAuthUsers = 0

    const candidates = report.findings.filter((finding) => {
      return (
        finding.safeAutoRepair &&
        finding.recommendedRepairAction === "delete_orphan_auth" &&
        finding.authUserId &&
        (values.action === "repair_safe" || values.action === "delete_orphan_auth")
      )
    })

    if (!values.dryRun) {
      for (const finding of candidates) {
        const { data, error: lookupError } = finding.authUserId
          ? await this.adminDb.auth.admin.getUserById(finding.authUserId)
          : { data: { user: null }, error: null }
        const authUser = lookupError ? null : data.user
        const decision = authUser
          ? await this.classifyAuthUserForDeletion(authUser, {
              organizationId: values.organizationId,
              hostelId: values.hostelId ?? null,
              trustedFromResetReport: false,
            })
          : { safe: false, reason: "auth user unavailable", blocker: "missing_auth_snapshot" }

        if (!decision.safe || !finding.authUserId) {
          warnings.push(
            `Skipped ${maskUuid(finding.authUserId ?? "unknown")}: ${decision.blocker ?? decision.reason}.`
          )
          continue
        }

        const { error } = await this.adminDb.auth.admin.deleteUser(finding.authUserId)

        if (error) {
          warnings.push(
            `Could not delete auth identity ${maskUuid(finding.authUserId)}: ${error.message}.`
          )
          continue
        }

        deletedAuthUsers += 1
      }
    }

    if (!values.dryRun && deletedAuthUsers > 0) {
      await this.writeAudit({
        organizationId: values.organizationId,
        hostelId: values.hostelId ?? null,
        actorUserId: context.authUser.id,
        action: "identity_repair.delete_orphan_auth",
        metadata: {
          deletedAuthUsers,
          candidateCount: candidates.length,
          warnings,
        },
      })
    }

    return {
      dryRun: values.dryRun,
      deletedAuthUsers: values.dryRun ? candidates.length : deletedAuthUsers,
      repairedResidents: 0,
      warnings,
      report,
    }
  }

  async prepareAuthCleanupForReset(
    report: DemoDataResetReport
  ): Promise<ResetAuthCleanupPlan> {
    const snapshot = await this.loadSnapshot({
      organizationId: report.organizationId,
      hostelId: report.hostelId ?? null,
    })
    const warnings: string[] = []
    const planned = new Map<string, DemoDataResetAuthUser>()

    for (const authUser of report.authUsers) {
      const liveAuthUser =
        snapshot.authUsers.find((candidate) => candidate.id === authUser.id) ??
        (await this.lookupAuthUser(authUser.id))

      if (!liveAuthUser) {
        warnings.push(
          `Skipped auth identity ${maskUuid(authUser.id)} during reset cleanup: identity was already absent.`
        )
        continue
      }

      const decision = await this.classifyAuthUserForDeletion(liveAuthUser, {
        organizationId: report.organizationId,
        hostelId: report.hostelId ?? null,
        trustedFromResetReport: true,
      })

      if (!decision.safe) {
        warnings.push(
          `Skipped auth identity ${maskUuid(authUser.id)} during reset cleanup: ${decision.blocker ?? decision.reason}.`
        )
        continue
      }

      planned.set(authUser.id, {
        id: liveAuthUser.id,
        email: liveAuthUser.email ?? authUser.email ?? null,
        phone: liveAuthUser.phone ?? authUser.phone ?? null,
        reason: decision.reason,
      })
    }

    for (const authUser of snapshot.authUsers) {
      const decision = await this.classifyAuthUserForDeletion(authUser, {
        organizationId: report.organizationId,
        hostelId: report.hostelId ?? null,
        trustedFromResetReport: planned.has(authUser.id),
      })

      if (decision.safe) {
        planned.set(authUser.id, {
          id: authUser.id,
          email: authUser.email ?? null,
          phone: authUser.phone ?? null,
          reason: decision.reason,
        })
      } else if (isScopedResidentAuthIdentity(authUser, report.organizationId, report.hostelId ?? null)) {
        warnings.push(
          `Skipped auth identity ${maskUuid(authUser.id)} during reset cleanup: ${decision.blocker ?? decision.reason}.`
        )
      }
    }

    return {
      authUsers: [...planned.values()],
      warnings,
    }
  }

  async deleteAuthUsersForReset(report: DemoDataResetReport) {
    const warnings: string[] = []
    let authUsersDeleted = 0

    for (const authUser of report.authUsers) {
      const { data, error: lookupError } = await this.adminDb.auth.admin.getUserById(authUser.id)

      if (lookupError || !data.user) {
        warnings.push(
          `Auth user cleanup skipped for ${maskUuid(authUser.id)}: identity was already absent.`
        )
        continue
      }

      const decision = await this.classifyAuthUserForDeletion(data.user, {
        organizationId: report.organizationId,
        hostelId: report.hostelId ?? null,
        trustedFromResetReport: true,
      })

      if (!decision.safe) {
        warnings.push(
          `Auth user cleanup skipped for ${maskUuid(authUser.id)}: ${decision.blocker ?? decision.reason}.`
        )
        continue
      }

      const { error } = await this.adminDb.auth.admin.deleteUser(authUser.id)

      if (error) {
        warnings.push(
          `Auth user cleanup failed for ${maskUuid(authUser.id)}: ${error.message}. Review the resident auth account manually.`
        )
        logger.warn({
          event: "identity_reconciliation.reset_auth_cleanup_failed",
          message: "Demo/test reset could not delete a resident auth user.",
          organizationId: report.organizationId,
          metadata: {
            userId: authUser.id,
          },
        })
        continue
      }

      authUsersDeleted += 1
    }

    return {
      authUsersDeleted,
      warnings,
    }
  }

  private async scanTrusted(input: {
    organizationId: string
    hostelId?: string | null
  }): Promise<IdentityReconciliationReport> {
    const snapshot = await this.loadSnapshot(input)
    const findings: IdentityReconciliationFinding[] = []
    const publicUserById = new Map(snapshot.publicUsers.map((user) => [user.id, user]))
    const residentsById = new Map(snapshot.residents.map((resident) => [resident.id, resident]))
    const residentByUserId = new Map(
      snapshot.residents
        .filter((resident) => resident.user_id)
        .map((resident) => [resident.user_id as string, resident])
    )
    const residentsByPhone = groupByNormalizedPhone(snapshot.residents)
    const authUsersByPhone = groupAuthByNormalizedPhone(snapshot.authUsers)
    const authByAlias = groupAuthByAlias(snapshot.authUsers)

    for (const resident of snapshot.residents) {
      if (resident.user_id) {
        const authUser = snapshot.authUsers.find((candidate) => candidate.id === resident.user_id)

        if (!authUser) {
          findings.push({
            id: `resident-missing-auth:${resident.id}`,
            category: "invalid_linkage",
            severity: "critical",
            title: "Resident is linked to a missing login identity",
            description: "The resident has user_id set, but Supabase Auth no longer has that user.",
            authUserId: resident.user_id,
            residentId: resident.id,
            organizationId: resident.organization_id,
            hostelId: resident.hostel_id,
            expectedState: "Supabase auth user exists and maps back to this resident.",
            actualState: "Auth user is missing.",
            recommendedRepairAction: "reset_onboarding",
            safeAutoRepair: false,
          })
        }
      } else if (hasActiveOnboardingAccess(resident)) {
        findings.push({
          id: `resident-without-auth:${resident.id}`,
          category: "resident_without_auth",
          severity: "high",
          title: "Resident onboarding has no login identity",
          description: "The resident can become stuck at activation pending until access is resent or repaired.",
          authUserId: null,
          residentId: resident.id,
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
          expectedState: "Draft/invited resident either has an active invite or no portal linkage yet.",
          actualState: "Resident has no linked auth user.",
          recommendedRepairAction: "reset_onboarding",
          safeAutoRepair: false,
        })
      }
    }

    for (const [phone, rows] of residentsByPhone) {
      if (rows.length <= 1) {
        continue
      }

      findings.push({
        id: `duplicate-resident-phone:${phone}`,
        category: "duplicate_phone",
        severity: rows.some((row) => row.user_id) ? "high" : "medium",
        title: "Duplicate resident phone identity",
        description: "Multiple active resident rows share the same normalized phone number.",
        residentId: rows[0].id,
        organizationId: input.organizationId,
        hostelId: input.hostelId ?? null,
        expectedState: "One operational resident row per normalized phone identity.",
        actualState: `${rows.length} resident rows share ${maskPhone(phone) ?? "the same phone"}.`,
        recommendedRepairAction: "dedupe_identity",
        safeAutoRepair: false,
      })
    }

    for (const [phone, users] of authUsersByPhone) {
      if (users.length <= 1) {
        continue
      }

      findings.push({
        id: `duplicate-auth-phone:${phone}`,
        category: "duplicate_phone",
        severity: "critical",
        title: "Duplicate auth phone identity",
        description: "More than one Supabase Auth identity uses the same normalized phone number.",
        authUserId: users[0].id,
        organizationId: input.organizationId,
        hostelId: input.hostelId ?? null,
        expectedState: "One auth identity per normalized resident phone.",
        actualState: `${users.length} auth users share ${maskPhone(phone) ?? "the same phone"}.`,
        recommendedRepairAction: "review_manually",
        safeAutoRepair: false,
      })
    }

    for (const [alias, users] of authByAlias) {
      if (users.length <= 1) {
        continue
      }

      findings.push({
        id: `duplicate-auth-alias:${alias}`,
        category: "duplicate_alias",
        severity: "critical",
        title: "Duplicate internal auth alias",
        description: "More than one Supabase Auth identity advertises the same resident login alias.",
        authUserId: users[0].id,
        organizationId: input.organizationId,
        hostelId: input.hostelId ?? null,
        expectedState: "One auth user per internal resident alias.",
        actualState: `${users.length} auth users share ${maskEmail(alias) ?? "the same alias"}.`,
        recommendedRepairAction: "review_manually",
        safeAutoRepair: false,
      })
    }

    for (const authUser of snapshot.authUsers) {
      const metadata = recordFromUnknown(authUser.user_metadata)
      const metadataResidentId = stringFromRecord(metadata, "resident_id")
      const publicUser = publicUserById.get(authUser.id)
      const linkedResident = residentByUserId.get(authUser.id)
      const metadataResident = metadataResidentId ? residentsById.get(metadataResidentId) : null
      const publicResidentProfile = isResidentPublicProfile(publicUser)
      const publicResidentRole = hasResidentRole(snapshot.roles, authUser.id)
      const decision = await this.classifyAuthUserForDeletion(authUser, {
        organizationId: input.organizationId,
        hostelId: input.hostelId ?? null,
        trustedFromResetReport: false,
      })

      if (
        isScopedResidentAuthIdentity(authUser, input.organizationId, input.hostelId ?? null) ||
        publicResidentProfile ||
        publicResidentRole
      ) {
        if (!linkedResident && !metadataResident) {
          findings.push({
            id: `orphan-auth:${authUser.id}`,
            category: "auth_without_resident",
            severity: decision.safe ? "critical" : "high",
            title: "Orphan resident auth identity",
            description: "Supabase Auth still has a resident login identity, but no resident row owns it.",
            authUserId: authUser.id,
            residentId: metadataResidentId ?? null,
            organizationId: input.organizationId,
            hostelId: stringFromRecord(metadata, "hostel_id") ?? input.hostelId ?? null,
            expectedState: "Resident auth identity has a live resident row and public profile.",
            actualState: publicUser
              ? "Public user exists, but no resident row is linked."
              : "Auth user exists without resident or public profile linkage.",
            recommendedRepairAction: decision.safe ? "delete_orphan_auth" : "review_manually",
            safeAutoRepair: decision.safe,
          })
        } else if (
          metadataResident &&
          linkedResident &&
          metadataResident.id !== linkedResident.id
        ) {
          findings.push({
            id: `stale-auth-metadata:${authUser.id}`,
            category: "orphan_metadata",
            severity: "high",
            title: "Auth metadata points to a different resident",
            description: "Auth user metadata and resident.user_id disagree about ownership.",
            authUserId: authUser.id,
            residentId: linkedResident.id,
            organizationId: input.organizationId,
            hostelId: linkedResident.hostel_id,
            expectedState: `Auth metadata resident_id ${linkedResident.id}.`,
            actualState: `Auth metadata resident_id ${metadataResident.id}.`,
            recommendedRepairAction: "relink_resident",
            safeAutoRepair: false,
          })
        } else if (linkedResident) {
          const publicMetadata = recordFromUnknown(publicUser?.metadata)
          const publicAlias =
            getResidentMetadataAuthLoginEmail(publicMetadata) ??
            normalizeEmailCandidate(publicUser?.email)
          const authAlias = resolveResidentAuthLoginEmail({
            residentId: linkedResident.id,
            profileMetadata: publicMetadata,
            authMetadata: metadata,
            profileEmail: publicUser?.email,
            authEmail: authUser.email,
            residentEmail: linkedResident.email,
          })

          if (!publicAlias || publicAlias !== authAlias) {
            findings.push({
              id: `resident-auth-alias-desync:${authUser.id}`,
              category: "invalid_linkage",
              severity: publicAlias ? "medium" : "high",
              title: "Resident password login alias is not synchronized",
              description: "The resident can activate successfully but later fail phone/password login when public profile metadata loses the auth alias.",
              authUserId: authUser.id,
              residentId: linkedResident.id,
              organizationId: input.organizationId,
              hostelId: linkedResident.hostel_id,
              expectedState: `public.users metadata auth_login_email ${maskEmail(authAlias) ?? "is present"}.`,
              actualState: publicAlias
                ? `public.users resolves ${maskEmail(publicAlias) ?? "a different alias"}.`
                : "public.users has no password-login alias.",
              recommendedRepairAction: "relink_resident",
              safeAutoRepair: false,
            })
          }
        }
      }
    }

    for (const publicUser of snapshot.publicUsers) {
      if (!isResidentPublicProfile(publicUser) && !hasResidentRole(snapshot.roles, publicUser.id)) {
        continue
      }

      if (residentByUserId.has(publicUser.id)) {
        continue
      }

      const authUser = snapshot.authUsers.find((candidate) => candidate.id === publicUser.id)

      if (authUser) {
        continue
      }

      findings.push({
        id: `orphan-public-user:${publicUser.id}`,
        category: "invalid_linkage",
        severity: "high",
        title: "Resident public profile has no resident record",
        description: "A resident login profile remains after resident cleanup, but no resident row owns it.",
        authUserId: publicUser.id,
        residentId: null,
        organizationId: publicUser.organization_id,
        hostelId: input.hostelId ?? null,
        expectedState: "Resident public profile is linked to a live resident and Supabase Auth identity.",
        actualState: "Public user exists without resident or auth linkage.",
        recommendedRepairAction: "review_manually",
        safeAutoRepair: false,
      })
    }

    return buildReport({
      organizationId: input.organizationId,
      hostelId: input.hostelId ?? null,
      scannedAuthUsers: snapshot.authUsers.length,
      findings,
    })
  }

  private async loadSnapshot(input: {
    organizationId: string
    hostelId?: string | null
  }): Promise<IdentitySnapshot> {
    const [authUsers, residents, publicUsers, roles] = await Promise.all([
      listAuthUsers(this.adminDb),
      this.listResidents(input),
      this.listPublicUsers(input.organizationId),
      this.listUserRoles(input.organizationId),
    ])

    const relevantAuthUsers = authUsers.filter((user) => {
      return isAuthRelevantToScope(user, input, residents, publicUsers, roles)
    })

    return {
      authUsers: relevantAuthUsers,
      residents,
      publicUsers,
      roles,
    }
  }

  private async listResidents(input: {
    organizationId: string
    hostelId?: string | null
  }) {
    let query = this.adminDb
      .from("residents")
      .select("id,organization_id,hostel_id,user_id,full_name,email,phone,status,is_active,deleted_at")
      .eq("organization_id", input.organizationId)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query

    if (error) {
      throw badRequest("Unable to load resident identity records.")
    }

    return (data ?? []) as ResidentIdentityRow[]
  }

  private async listPublicUsers(organizationId: string) {
    const { data, error } = await this.adminDb
      .from("users")
      .select("id,organization_id,email,phone,default_role,is_platform_user,is_active,metadata,deleted_at")
      .eq("organization_id", organizationId)

    if (error) {
      throw badRequest("Unable to load public user identity records.")
    }

    return data ?? []
  }

  private async listUserRoles(organizationId: string) {
    const { data, error } = await this.adminDb
      .from("user_roles")
      .select("user_id,organization_id,hostel_id,role,status,deleted_at")
      .eq("organization_id", organizationId)

    if (error) {
      throw badRequest("Unable to load user role identity records.")
    }

    return data ?? []
  }

  private async classifyAuthUserForDeletion(
    authUser: User,
    input: {
      organizationId: string
      hostelId?: string | null
      trustedFromResetReport: boolean
    }
  ): Promise<AuthDeletionDecision> {
    const metadata = recordFromUnknown(authUser.user_metadata)
    const publicUser = await this.getPublicUser(authUser.id)
    const roles = await this.getRoles(authUser.id)

    if (publicUser?.is_platform_user) {
      return {
        safe: false,
        reason: "platform user",
        blocker: "platform users are never deleted by resident cleanup",
      }
    }

    if (
      publicUser &&
      (ADMIN_PORTAL_ROLES as readonly AppRole[]).includes(publicUser.default_role)
    ) {
      return {
        safe: false,
        reason: "admin/staff profile",
        blocker: `public user role is ${publicUser.default_role}`,
      }
    }

    const unsafeRole = roles.find((role) => {
      return !RESIDENT_SAFE_ROLES.has(role.role) && role.deleted_at === null
    })

    if (unsafeRole) {
      return {
        safe: false,
        reason: "admin/staff role",
        blocker: `active role ${unsafeRole.role} is not resident cleanup safe`,
      }
    }

    if (publicUser?.organization_id && publicUser.organization_id !== input.organizationId) {
      return {
        safe: false,
        reason: "tenant mismatch",
        blocker: "public user belongs to another organization",
      }
    }

    const metadataOrgId = stringFromRecord(metadata, "organization_id")

    if (
      metadataOrgId &&
      metadataOrgId !== input.organizationId
    ) {
      return {
        safe: false,
        reason: "tenant mismatch",
        blocker: "auth metadata belongs to another organization",
      }
    }

    const metadataHostelId = stringFromRecord(metadata, "hostel_id")

    if (
      input.hostelId &&
      metadataHostelId &&
      metadataHostelId !== input.hostelId
    ) {
      return {
        safe: false,
        reason: "hostel mismatch",
        blocker: "auth metadata belongs to another hostel",
      }
    }

    const hasResidentProfile =
      publicUser?.default_role && RESIDENT_SAFE_ROLES.has(publicUser.default_role)
    const hasResidentRole = roles.some((role) => {
      return RESIDENT_SAFE_ROLES.has(role.role) && role.deleted_at === null
    })
    const hasResidentMarkers = hasResidentAuthMarkers(authUser)

    if (!input.trustedFromResetReport && !hasResidentProfile && !hasResidentRole && !hasResidentMarkers) {
      return {
        safe: false,
        reason: "not resident auth",
        blocker: "identity does not contain resident cleanup markers",
      }
    }

    return {
      safe: true,
      reason: input.trustedFromResetReport
        ? "resident/test auth user linked to reset resident"
        : "orphan resident auth identity",
    }
  }

  private async getPublicUser(userId: string) {
    const { data, error } = await this.adminDb
      .from("users")
      .select("id,organization_id,email,phone,default_role,is_platform_user,is_active,metadata,deleted_at")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      return null
    }

    return data
  }

  private async lookupAuthUser(userId: string) {
    const { data, error } = await this.adminDb.auth.admin.getUserById(userId)

    if (error) {
      return null
    }

    return data.user
  }

  private async getRoles(userId: string) {
    const { data, error } = await this.adminDb
      .from("user_roles")
      .select("user_id,organization_id,hostel_id,role,status,deleted_at")
      .eq("user_id", userId)

    if (error) {
      return []
    }

    return data ?? []
  }

  private async writeAudit(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId: string
    action: string
    metadata: Record<string, unknown>
  }) {
    const { error } = await this.adminDb
      .from("audit_logs")
      .insert({
        organization_id: input.organizationId,
        hostel_id: input.hostelId ?? null,
        actor_user_id: input.actorUserId,
        table_name: "identity_reconciliation",
        record_id: null,
        action: input.action,
        old_values: null,
        new_values: null,
        metadata: input.metadata as Json,
        created_by: input.actorUserId,
        updated_by: input.actorUserId,
      })

    if (error) {
      logger.warn({
        event: "identity_reconciliation.audit_failed",
        message: "Identity repair audit log could not be written.",
        organizationId: input.organizationId,
        metadata: {
          error: error.message,
          action: input.action,
        },
      })
    }
  }
}

async function listAuthUsers(adminDb: AppSupabaseClient) {
  const users: User[] = []

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminDb.auth.admin.listUsers({
      page,
      perPage: 100,
    })

    if (error) {
      throw badRequest("Unable to inspect Supabase Auth identities.")
    }

    users.push(...data.users)

    if (data.users.length < 100) {
      break
    }
  }

  return users
}

function isAuthRelevantToScope(
  user: User,
  input: { organizationId: string; hostelId?: string | null },
  residents: ResidentIdentityRow[],
  publicUsers: PublicUserIdentityRow[],
  roles: UserRoleIdentityRow[]
) {
  if (residents.some((resident) => resident.user_id === user.id)) {
    return true
  }

  if (publicUsers.some((profile) => profile.id === user.id)) {
    return true
  }

  if (roles.some((role) => role.user_id === user.id)) {
    return true
  }

  return isScopedResidentAuthIdentity(user, input.organizationId, input.hostelId ?? null)
}

function isScopedResidentAuthIdentity(
  user: User,
  organizationId: string,
  hostelId?: string | null
) {
  const metadata = recordFromUnknown(user.user_metadata)
  const metadataOrgId = stringFromRecord(metadata, "organization_id")
  const metadataHostelId = stringFromRecord(metadata, "hostel_id")

  if (metadataOrgId !== organizationId) {
    return false
  }

  if (hostelId && metadataHostelId && metadataHostelId !== hostelId) {
    return false
  }

  return hasResidentAuthMarkers(user)
}

function hasResidentAuthMarkers(user: User) {
  const metadata = recordFromUnknown(user.user_metadata)
  const email = normalizeEmail(user.email)

  return Boolean(
    stringFromRecord(metadata, "resident_id") ||
      stringFromRecord(metadata, "auth_login_email") ||
      stringFromRecord(metadata, "internal_auth_email") ||
      stringFromRecord(metadata, "resident_identity_mode") ||
      stringFromRecord(metadata, "resident_access_mode") ||
      stringFromRecord(metadata, "phone_password_login_strategy") ||
      metadata.activated_from_invite === true ||
      email?.endsWith("@auth.sadhanahostel.invalid")
  )
}

function groupByNormalizedPhone(residents: ResidentIdentityRow[]) {
  const grouped = new Map<string, ResidentIdentityRow[]>()

  for (const resident of residents) {
    const phone = safeNormalizePhone(resident.phone)

    if (!phone || resident.deleted_at) {
      continue
    }

    const rows = grouped.get(phone) ?? []

    rows.push(resident)
    grouped.set(phone, rows)
  }

  return grouped
}

function groupAuthByNormalizedPhone(users: User[]) {
  const grouped = new Map<string, User[]>()

  for (const user of users) {
    const phone = safeNormalizePhone(user.phone)

    if (!phone) {
      continue
    }

    const rows = grouped.get(phone) ?? []

    rows.push(user)
    grouped.set(phone, rows)
  }

  return grouped
}

function groupAuthByAlias(users: User[]) {
  const grouped = new Map<string, User[]>()

  for (const user of users) {
    const metadata = recordFromUnknown(user.user_metadata)
    const alias =
      normalizeEmail(stringFromRecord(metadata, "internal_auth_email")) ??
      normalizeEmail(stringFromRecord(metadata, "auth_login_email")) ??
      (normalizeEmail(user.email)?.endsWith("@auth.sadhanahostel.invalid")
        ? normalizeEmail(user.email)
        : null)

    if (!alias) {
      continue
    }

    const rows = grouped.get(alias) ?? []

    rows.push(user)
    grouped.set(alias, rows)
  }

  return grouped
}

function isResidentPublicProfile(user?: PublicUserIdentityRow | null) {
  return Boolean(
    user &&
      !user.deleted_at &&
      RESIDENT_SAFE_ROLES.has(user.default_role)
  )
}

function hasResidentRole(roles: UserRoleIdentityRow[], userId: string) {
  return roles.some((role) => {
    return (
      role.user_id === userId &&
      role.deleted_at === null &&
      role.status === "active" &&
      RESIDENT_SAFE_ROLES.has(role.role)
    )
  })
}

function hasActiveOnboardingAccess(resident: ResidentIdentityRow) {
  return (
    resident.status === "draft" ||
    resident.status === "active" ||
    resident.onboarding_status === "invited" ||
    resident.onboarding_status === "activated" ||
    resident.onboarding_status === "profile_incomplete" ||
    resident.onboarding_status === "documents_pending" ||
    resident.onboarding_status === "verification_pending"
  )
}

function buildReport(input: {
  organizationId: string
  hostelId?: string | null
  scannedAuthUsers: number
  findings: IdentityReconciliationFinding[]
}): IdentityReconciliationReport {
  return {
    organizationId: input.organizationId,
    hostelId: input.hostelId ?? null,
    generatedAt: new Date().toISOString(),
    scannedAuthUsers: input.scannedAuthUsers,
    findings: input.findings,
    summaries: {
      critical: countSeverity(input.findings, "critical"),
      high: countSeverity(input.findings, "high"),
      medium: countSeverity(input.findings, "medium"),
      low: countSeverity(input.findings, "low"),
      informational: countSeverity(input.findings, "informational"),
      totalFindings: input.findings.length,
      safeAutoRepairs: input.findings.filter((finding) => finding.safeAutoRepair).length,
    },
  }
}

function countSeverity(
  findings: IdentityReconciliationFinding[],
  severity: IdentityReconciliationFinding["severity"]
) {
  return findings.filter((finding) => finding.severity === severity).length
}

function safeNormalizePhone(value?: string | null) {
  try {
    return normalizeOptionalPhoneNumber(value)
  } catch {
    return null
  }
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase()

  return email && email.includes("@") ? email : null
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function stringFromRecord(value: unknown, key: string) {
  const record = recordFromUnknown(value)
  const nextValue = record[key]

  return typeof nextValue === "string" ? nextValue : null
}

function maskUuid(value: string) {
  if (value.length <= 12) {
    return value
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`
}
