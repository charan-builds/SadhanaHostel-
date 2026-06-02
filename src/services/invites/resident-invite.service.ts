import "server-only"

import { randomBytes, randomUUID } from "node:crypto"

import type { User } from "@supabase/supabase-js"

import { AUTH_REDIRECTS } from "@/constants/auth"
import { getServerEnv } from "@/config/env"
import { badRequest, conflict, forbidden, notFound, unauthorized } from "@/lib/api/api-error"
import {
  PhoneNormalizationError,
  normalizeOptionalPhoneNumber,
  phoneDigits,
  phoneNumbersMatch,
} from "@/lib/identity"
import { logger } from "@/lib/logger"
import { maskEmail, maskPhone } from "@/lib/security"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ResidentInvitesRepository } from "@/repositories/resident-invites.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import { RepositoryError } from "@/repositories/types"
import { UsersRepository } from "@/repositories/users.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { EmailQueueService } from "@/services/email"
import { RealtimeEventPublisher } from "@/services/realtime"
import type { Json } from "@/types/database"
import {
  getResidentIdentityMode,
  getResidentIdentityRequirement,
} from "@/lib/resident-identity"
import { buildResidentInternalAuthEmail } from "@/lib/resident-auth-identity"
import type {
  ResidentActivationResult,
  ResidentInviteCreated,
  ResidentInviteRow,
  ResidentInviteSafe,
} from "@/types/invites"
import {
  activateInviteSchema,
  createResidentInviteSchema,
  listResidentInvitesSchema,
  residentInviteActionSchema,
  validateInviteSchema,
} from "@/validations/invite.validation"

import {
  generateInviteCode,
  generateSignedInviteToken,
  hashInviteToken,
  verifySignedInviteToken,
} from "./invite-token"
import { AuthService } from "../auth.service"

const DEFAULT_INVITE_PERMISSIONS = ["resident.portal.access"]
const LOCAL_APP_URL = "http://localhost:3002"

type ResidentInviteServiceDependencies = {
  authService?: AuthService
  residentsRepository?: ResidentsRepository
  usersRepository?: UsersRepository
  invitesRepository?: ResidentInvitesRepository
  activationService?: Pick<ResidentInviteService, "activateInvite">
  eventPublisher?: Pick<RealtimeEventPublisher, "publish">
  emailQueue?: Pick<EmailQueueService, "sendTemplate">
}

type InviteAuthIdentity = {
  email?: string
  phone?: string
  authEmail?: string
  internalAuthEmail?: string
  mode: "email" | "phone" | "email_and_phone"
}

type ActivationAuthIdentity = {
  user: User
  created: boolean
  loginEmail?: string
  internalAuthEmail?: string
  identityMode: InviteAuthIdentity["mode"]
}

type ActivationResolvedInvite = {
  invite: ResidentInviteRow
  replay: boolean
}

type ExistingUserLinkState =
  | { status: "safe" }
  | { status: "stale_metadata"; staleResidentId: string }
  | {
      status: "linked_to_other_resident"
      resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
    }

export class ResidentInviteService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository
  private readonly usersRepository: UsersRepository
  private readonly invitesRepository: ResidentInvitesRepository
  private readonly activationService?: Pick<ResidentInviteService, "activateInvite">
  private readonly eventPublisher: Pick<RealtimeEventPublisher, "publish">
  private readonly emailQueue: Pick<EmailQueueService, "sendTemplate">

  constructor(
    private readonly db: AppSupabaseClient,
    dependencies: ResidentInviteServiceDependencies = {}
  ) {
    this.authService = dependencies.authService ?? new AuthService(db)
    this.residentsRepository = dependencies.residentsRepository ?? new ResidentsRepository(db)
    this.usersRepository = dependencies.usersRepository ?? new UsersRepository(db)
    this.invitesRepository = dependencies.invitesRepository ?? new ResidentInvitesRepository(db)
    this.activationService = dependencies.activationService
    this.eventPublisher = dependencies.eventPublisher ?? new RealtimeEventPublisher()
    this.emailQueue = dependencies.emailQueue ?? new EmailQueueService()
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ResidentInviteService(db)
  }

  static createActivation() {
    return new ResidentInviteService(createSupabaseAdminClient())
  }

  async listResidentInvites(input: unknown) {
    const values = listResidentInvitesSchema.parse(input)
    const context = await this.authService.requireAdmin()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    if (!values.residentId) {
      return []
    }

    const resident = await this.residentsRepository.getById(
      values.residentId,
      values.organizationId
    )

    if (!resident) {
      throw notFound("Resident not found.")
    }

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    return this.invitesRepository.listForResident(values.organizationId, values.residentId)
  }

  async createResidentInvite(input: unknown): Promise<ResidentInviteCreated> {
    const values = createResidentInviteSchema.parse(input)
    const context = await this.authService.requireAdmin()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = await this.getResidentForInvite(values.organizationId, values.residentId)

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    if (resident.user_id) {
      throw conflict("This resident already has an activated portal account.")
    }

    const token = generateSignedInviteToken()
    const inviteCode = generateInviteCode()
    const expiresAt = new Date(Date.now() + values.expiresInHours * 60 * 60 * 1000)
    const invitePhone = normalizeResidentInvitePhone(resident.phone)

    await this.invitesRepository.revokeActiveForResident(
      values.organizationId,
      values.residentId,
      context.authUser.id
    )

    const invite = await this.invitesRepository.create({
      organization_id: resident.organization_id,
      hostel_id: resident.hostel_id,
      resident_id: resident.id,
      email: resident.email,
      phone: invitePhone,
      invite_code: inviteCode,
      invite_token_hash: hashInviteToken(token),
      expires_at: expiresAt.toISOString(),
      invited_by: context.authUser.id,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
      metadata: {
        delivery_channel: values.deliveryChannel,
        access_mode: values.deliveryChannel === "temp_password"
          ? "temporary_password"
          : "activation_link",
        identity_mode: getResidentIdentityMode(resident),
        phone_verified: false,
        email_verified: false,
        auth_linkage_state: "activation_pending",
        temporary_password_expires_at: values.deliveryChannel === "temp_password"
          ? expiresAt.toISOString()
          : null,
        permissions: DEFAULT_INVITE_PERMISSIONS,
      } satisfies Json,
    })
    const loginLink = buildResidentLoginLink(invitePhone)
    let activationLink: string | null = buildActivationLink(token)
    let accessMode: "activation_link" | "temporary_password" = "activation_link"
    let temporaryPassword: string | null = null

    if (values.deliveryChannel === "temp_password") {
      temporaryPassword = generateTemporaryPassword()
      accessMode = "temporary_password"

      const activationService =
        this.activationService ?? new ResidentInviteService(createSupabaseAdminClient())

      await activationService.activateInvite({
        token,
        password: temporaryPassword,
        confirmPassword: temporaryPassword,
      })

      const activatedInvite = await this.invitesRepository.getById(
        invite.id,
        invite.organization_id
      )

      if (activatedInvite) {
        invite.status = activatedInvite.status
        invite.used_at = activatedInvite.used_at
        invite.updated_at = activatedInvite.updated_at
        invite.updated_by = activatedInvite.updated_by
      }

      activationLink = null
    }

    const whatsappShareUrl = buildWhatsappShareUrl({
      phone: invitePhone,
      activationLink,
      loginLink,
      inviteCode,
      temporaryPassword,
    })

    await this.sendInviteEmail({
      invite,
      activationLink,
      residentName: resident.full_name,
      deliveryChannel: values.deliveryChannel,
    })
    await this.publish("resident.invite_created", invite, context.authUser.id, {
      inviteId: invite.id,
      residentId: resident.id,
      expiresAt: invite.expires_at,
    })

    logger.info({
      event: "resident_invite.created",
      message: "Resident activation invite created.",
      organizationId: invite.organization_id,
      userId: context.authUser.id,
      metadata: {
        inviteId: invite.id,
        residentId: invite.resident_id,
        deliveryChannel: values.deliveryChannel,
      },
    })

    return {
      invite,
      activationLink,
      loginLink,
      whatsappShareUrl,
      delivery: {
        emailQueued: Boolean(invite.email && values.deliveryChannel === "email"),
        whatsappReady: Boolean(whatsappShareUrl),
        accessMode,
        temporaryPassword,
      },
    }
  }

  async resendResidentInvite(input: unknown) {
    const values = residentInviteActionSchema.parse(input)
    const context = await this.authService.requireAdmin()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const existing = await this.invitesRepository.getById(
      values.inviteId,
      values.organizationId
    )

    if (!existing) {
      throw notFound("Resident invite not found.")
    }

    this.authService.requireHostelAccess(context, existing.organization_id, existing.hostel_id)

    const nextInvite = await this.createResidentInvite({
      organizationId: existing.organization_id,
      residentId: existing.resident_id,
      deliveryChannel: "copy_link",
    })

    await this.publish("resident.invite_resent", nextInvite.invite, context.authUser.id, {
      inviteId: nextInvite.invite.id,
      previousInviteId: existing.id,
      residentId: existing.resident_id,
    })

    return nextInvite
  }

  async revokeResidentInvite(input: unknown) {
    const values = residentInviteActionSchema.parse(input)
    const context = await this.authService.requireAdmin()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const existing = await this.invitesRepository.getById(
      values.inviteId,
      values.organizationId
    )

    if (!existing) {
      throw notFound("Resident invite not found.")
    }

    this.authService.requireHostelAccess(context, existing.organization_id, existing.hostel_id)

    const invite = await this.invitesRepository.revoke(
      values.inviteId,
      values.organizationId,
      context.authUser.id
    )

    await this.publish("resident.invite_revoked", invite, context.authUser.id, {
      inviteId: invite.id,
      residentId: invite.resident_id,
    })

    return invite
  }

  async validateInvite(input: unknown): Promise<ResidentInviteSafe> {
    const values = validateInviteSchema.parse(input)
    const invite = await this.resolveUsableInvite(values)
    const resident = await this.getResidentForInvite(invite.organization_id, invite.resident_id)

    return toSafeInvite(invite, resident)
  }

  async activateInvite(input: unknown): Promise<ResidentActivationResult> {
    const values = activateInviteSchema.parse(input)
    const correlationId = randomUUID()
    const resolvedInvite = await this.resolveInviteForActivation(values)
    const invite = resolvedInvite.invite
    const resident = await this.getResidentForInvite(invite.organization_id, invite.resident_id)
    const existingAuthUser =
      (await this.findAuthUserForInvite(invite)) ??
      (await this.findAuthUserForResidentLink(resident))

    await this.logActivationTrace("preflight", "info", {
      invite,
      resident,
      authUser: existingAuthUser,
      correlationId,
      requestedIdentity: getRequestedActivationIdentity(values),
    })

    if (resolvedInvite.replay) {
      return this.resumeUsedInviteActivation({
        invite,
        resident,
        authUser: existingAuthUser,
        correlationId,
        requestedIdentity: getRequestedActivationIdentity(values),
        password: values.password,
      })
    }

    const recovery = await this.tryRecoverExistingAuthLink({
      invite,
      resident,
      authUser: existingAuthUser,
      password: values.password,
      correlationId,
      requestedIdentity: getRequestedActivationIdentity(values),
    })

    if (recovery) {
      return recovery
    }

    this.assertResidentCanStartActivation({
      invite,
      resident,
      authUser: existingAuthUser,
    })

    const authIdentity = await this.upsertAuthUserForInvite({
      invite,
      residentName: resident.full_name,
      password: values.password,
      existingAuthUser,
    })
    const authUser = authIdentity.user

    await this.assertExistingUserIsSafe(authUser, invite)

    await this.logActivationTrace("auth_identity_ready", "info", {
      invite,
      resident,
      authUser,
      authCreated: authIdentity.created,
      correlationId,
      requestedIdentity: getRequestedActivationIdentity(values),
    })

    try {
      await this.invitesRepository.activateInviteAtomic({
        inviteId: invite.id,
        inviteTokenHash: invite.invite_token_hash,
        authUserId: authUser.id,
      })
    } catch (error) {
      await this.logActivationTrace("bootstrap_failed", "error", {
        invite,
        resident,
        authUser,
        authCreated: authIdentity.created,
        correlationId,
        requestedIdentity: getRequestedActivationIdentity(values),
        error,
      })

      await this.rollbackCreatedAuthUserOnBootstrapFailure({
        authIdentity,
        invite,
        cause: error,
      })

      throw mapActivationBootstrapError(error, {
        resident,
        invite,
        authUser,
      })
    }

    await this.logActivationTrace("bootstrap_completed", "info", {
      invite,
      resident,
      authUser,
      authCreated: authIdentity.created,
      correlationId,
      requestedIdentity: getRequestedActivationIdentity(values),
    })

    await this.syncActivatedPublicProfile({
      invite,
      resident,
      authIdentity,
    })

    await this.publish("resident.invite_used", invite, authUser.id, {
      inviteId: invite.id,
      residentId: invite.resident_id,
      userId: authUser.id,
    })

    logger.info({
      event: "resident_invite.activated",
      message: "Resident activated account from invite.",
      organizationId: invite.organization_id,
      userId: authUser.id,
      metadata: {
        inviteId: invite.id,
        residentId: invite.resident_id,
      },
    })

    return {
      authenticatedIdentifier: getActivationLoginIdentifier(authUser, invite),
      residentId: invite.resident_id,
      redirectTo: AUTH_REDIRECTS.residentOnboarding,
    }
  }

  async expireDueInvites(input: { organizationId?: string; hostelId?: string; limit?: number }) {
    const cleanup = await this.invitesRepository.cleanupOnboardingAccess(input)

    return (
      cleanup.expired_count +
      cleanup.activated_invites_revoked_count +
      cleanup.duplicate_invites_revoked_count
    )
  }

  private async resolveUsableInvite(input: {
    token?: string
    inviteCode?: string
    email?: string
    phone?: string
  }) {
    const invite = input.token
      ? await this.resolveInviteByToken(input.token)
      : await this.invitesRepository.findByCodeAndIdentity({
          inviteCode: normalizeInviteCode(input.inviteCode),
          email: normalizeEmail(input.email),
          phone: normalizeOptionalPhoneNumber(input.phone),
        })

    if (!invite) {
      throw unauthorized("Invalid or expired invite.")
    }

    if (input.email || input.phone) {
      this.assertIdentityMatchesInvite(invite, input.email, input.phone)
    }

    if (invite.status !== "pending" || invite.used_at || invite.revoked_at) {
      throw conflict("This invite is no longer active.")
    }

    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await this.invitesRepository.markExpired(invite.id)
      throw conflict("This invite has expired. Ask the hostel admin to resend access.")
    }

    return invite
  }

  private async resolveInviteForActivation(input: {
    token?: string
    inviteCode?: string
    email?: string
    phone?: string
  }): Promise<ActivationResolvedInvite> {
    const invite = input.token
      ? await this.resolveInviteByToken(input.token)
      : await this.invitesRepository.findByCodeAndIdentity({
          inviteCode: normalizeInviteCode(input.inviteCode),
          email: normalizeEmail(input.email),
          phone: normalizeOptionalPhoneNumber(input.phone),
        })

    if (!invite) {
      throw unauthorized("Invalid or expired invite.")
    }

    if (input.email || input.phone) {
      this.assertIdentityMatchesInvite(invite, input.email, input.phone)
    }

    if (invite.status === "used" && invite.used_at) {
      return { invite, replay: true }
    }

    if (invite.status === "revoked" || invite.revoked_at) {
      throw conflict("This invite was revoked. Ask the hostel office to resend access.")
    }

    if (
      invite.status === "expired" ||
      new Date(invite.expires_at).getTime() <= Date.now()
    ) {
      if (invite.status === "pending") {
        await this.invitesRepository.markExpired(invite.id)
      }

      throw conflict("This invite has expired. Ask the hostel admin to resend access.")
    }

    if (invite.status !== "pending") {
      throw conflict("This invite is no longer active.")
    }

    return { invite, replay: false }
  }

  private async resolveInviteByToken(token: string) {
    if (!verifySignedInviteToken(token)) {
      throw unauthorized("Invalid invite token.")
    }

    return this.invitesRepository.findByTokenHash(hashInviteToken(token))
  }

  private assertIdentityMatchesInvite(
    invite: ResidentInviteRow,
    email?: string,
    phone?: string
  ) {
    const normalizedEmail = normalizeEmail(email)
    const normalizedPhone = normalizeOptionalPhoneNumber(phone)

    if (normalizedEmail && !invite.email) {
      throw forbidden(
        "This invite uses phone verification. Enter the phone number shared with hostel administration."
      )
    }

    if (normalizedPhone && !invite.phone) {
      throw forbidden(
        "This invite uses email verification. Enter the email shared with hostel administration."
      )
    }

    if (normalizedEmail && invite.email && normalizedEmail !== normalizeEmail(invite.email)) {
      throw forbidden("Invite email does not match this resident record.")
    }

    if (normalizedPhone && invite.phone && !phoneNumbersMatch(normalizedPhone, invite.phone)) {
      throw forbidden("Invite phone does not match this resident record.")
    }

    if (normalizedEmail || normalizedPhone) {
      return
    }

    throw forbidden("Invite identity does not match this resident record.")
  }

  private async getResidentForInvite(organizationId: string, residentId: string) {
    const resident = await this.residentsRepository.getById(residentId, organizationId)

    if (!resident) {
      throw notFound("Resident not found.")
    }

    if (!resident.email && !resident.phone) {
      throw badRequest("Resident needs an email or phone before invite access can be sent.")
    }

    return resident
  }

  private async upsertAuthUserForInvite(input: {
    invite: ResidentInviteRow
    residentName: string
    password: string
    existingAuthUser?: User | null
    updatePassword?: boolean
  }): Promise<ActivationAuthIdentity> {
    const identity = buildInviteAuthIdentity(input.invite)
    const existing = input.existingAuthUser ?? await this.findAuthUserForInvite(input.invite)
    const userMetadata = {
      ...recordFromUnknown(existing?.user_metadata),
      ...buildAuthActivationMetadata(input.invite, input.residentName, identity),
    }

    if (existing) {
      await this.assertExistingUserIsSafe(existing, input.invite)

      const payload: Parameters<typeof this.db.auth.admin.updateUserById>[1] = {
        user_metadata: userMetadata,
      }

      if (input.updatePassword !== false) {
        payload.password = input.password
      }

      if (identity.authEmail) {
        payload.email = identity.authEmail
        payload.email_confirm = true
      }

      if (identity.phone) {
        payload.phone = identity.phone
        payload.phone_confirm = true
      }

      logAuthIdentityPayload("resident_invite_update", identity, payload)

      const { data, error } = await this.db.auth.admin.updateUserById(existing.id, payload)

      if (error || !data.user) {
        mapAuthIdentityError(error?.message, identity, "update")
      }

      return {
        user: data.user,
        created: false,
        loginEmail: identity.authEmail,
        internalAuthEmail: identity.internalAuthEmail,
        identityMode: identity.mode,
      }
    }

    const payload: Parameters<typeof this.db.auth.admin.createUser>[0] = {
      password: input.password,
      user_metadata: userMetadata,
    }

    if (identity.authEmail) {
      payload.email = identity.authEmail
      payload.email_confirm = true
    }

    if (identity.phone) {
      payload.phone = identity.phone
      payload.phone_confirm = true
    }

    logAuthIdentityPayload("resident_invite_create", identity, payload)

    const { data, error } = await this.db.auth.admin.createUser(payload)

    if (error || !data.user) {
      if (error && isDuplicateAuthIdentityError(error.message, identity)) {
        const recoveredAuthUser = await this.findAuthUserForInvite(input.invite)

        if (recoveredAuthUser) {
          await this.logActivationTrace("auth_identity_race_recovered", "warn", {
            invite: input.invite,
            resident: null,
            authUser: recoveredAuthUser,
            recovery: {
              reason: "provider_duplicate_after_preflight",
              operation: "create",
            },
          })

          return this.upsertAuthUserForInvite({
            ...input,
            existingAuthUser: recoveredAuthUser,
          })
        }
      }

      mapAuthIdentityError(error?.message, identity, "create")
    }

    return {
      user: data.user,
      created: true,
      loginEmail: identity.authEmail,
      internalAuthEmail: identity.internalAuthEmail,
      identityMode: identity.mode,
    }
  }

  private async findAuthUserForInvite(invite: ResidentInviteRow) {
    const normalizedEmail = normalizeEmail(invite.email)
    const normalizedPhone = normalizeOptionalPhoneNumber(invite.phone)
    const internalAuthEmail = buildResidentInternalAuthEmail(invite.resident_id)

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await this.db.auth.admin.listUsers({
        page,
        perPage: 100,
      })

      if (error) {
        throw forbidden(error.message)
      }

      const user = data.users.find((candidate) => {
        return (
          (normalizedEmail && normalizeEmail(candidate.email) === normalizedEmail) ||
          normalizeEmail(candidate.email) === internalAuthEmail ||
          (normalizedPhone && phoneNumbersMatch(candidate.phone, normalizedPhone))
        )
      })

      if (user) {
        return user
      }

      if (data.users.length < 100) {
        return null
      }
    }

    return null
  }

  private async findAuthUserForResidentLink(
    resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
  ) {
    const residentUserId = stringFromRecord(resident, "user_id")

    if (!residentUserId) {
      return null
    }

    const { data, error } = await this.db.auth.admin.getUserById(residentUserId)

    if (error) {
      logger.warn({
        event: "resident_invite.activation_linked_auth_lookup_failed",
        message: "Resident has a user_id but the linked auth identity could not be loaded.",
        organizationId: resident.organization_id,
        userId: residentUserId,
        metadata: {
          residentId: resident.id,
          error: error.message,
        },
      })

      return null
    }

    return data.user
  }

  private async assertExistingUserIsSafe(user: User, invite: ResidentInviteRow) {
    const state = await this.getExistingUserLinkState(user, invite)

    if (state.status === "linked_to_other_resident") {
      throw conflict("This login account is already linked to another resident.")
    }
  }

  private async getExistingUserLinkState(
    user: User,
    invite: ResidentInviteRow
  ): Promise<ExistingUserLinkState> {
    const userMetadata = recordFromUnknown(user.user_metadata)
    const userOrganizationId = typeof userMetadata.organization_id === "string"
      ? userMetadata.organization_id
      : null
    const userResidentId = typeof userMetadata.resident_id === "string"
      ? userMetadata.resident_id
      : null

    if (userOrganizationId && userOrganizationId !== invite.organization_id) {
      throw forbidden("This login account belongs to another organization.")
    }

    if (userResidentId && userResidentId !== invite.resident_id) {
      const metadataResident = await this.residentsRepository.getById(
        userResidentId,
        invite.organization_id
      )

      if (metadataResident) {
        return {
          status: "linked_to_other_resident",
          resident: metadataResident,
        }
      }

      return {
        status: "stale_metadata",
        staleResidentId: userResidentId,
      }
    }

    const profile = await this.usersRepository.getById(user.id)

    if (!profile) {
      return { status: "safe" }
    }

    if (profile.organization_id && profile.organization_id !== invite.organization_id) {
      throw forbidden("This login account belongs to another organization.")
    }

    const linkedResident = await this.residentsRepository.getByUserId(
      user.id,
      invite.organization_id
    )

    if (linkedResident && linkedResident.id !== invite.resident_id) {
      return {
        status: "linked_to_other_resident",
        resident: linkedResident,
      }
    }

    return { status: "safe" }
  }

  private async rollbackCreatedAuthUserOnBootstrapFailure(input: {
    authIdentity: ActivationAuthIdentity
    invite: ResidentInviteRow
    cause: unknown
  }) {
    if (!input.authIdentity.created) {
      return
    }

    const { error } = await this.db.auth.admin.deleteUser(input.authIdentity.user.id)

    if (error) {
      logger.error({
        event: "resident_invite.activation_auth_rollback_failed",
        message: "Newly created auth user could not be removed after activation bootstrap failure.",
        organizationId: input.invite.organization_id,
        userId: input.authIdentity.user.id,
        metadata: {
          inviteId: input.invite.id,
          residentId: input.invite.resident_id,
          rollbackError: error.message,
          bootstrapError: input.cause instanceof Error ? input.cause.message : String(input.cause),
        },
      })
    }
  }

  private async resumeUsedInviteActivation(input: {
    invite: ResidentInviteRow
    resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
    authUser: User | null
    correlationId: string
    requestedIdentity: ReturnType<typeof getRequestedActivationIdentity>
    password: string
  }): Promise<ResidentActivationResult> {
    const residentUserId = stringFromRecord(input.resident, "user_id")

    await this.logActivationTrace("activation_replay_detected", "warn", {
      invite: input.invite,
      resident: input.resident,
      authUser: input.authUser,
      correlationId: input.correlationId,
      requestedIdentity: input.requestedIdentity,
    })

    if (!residentUserId) {
      return this.recoverUsedInviteWithoutResidentLink(input)
    }

    throw inviteAlreadyUsedConflict()
  }

  private async recoverUsedInviteWithoutResidentLink(input: {
    invite: ResidentInviteRow
    resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
    authUser: User | null
    correlationId: string
    requestedIdentity: ReturnType<typeof getRequestedActivationIdentity>
    password: string
  }): Promise<ResidentActivationResult> {
    if (!input.authUser) {
      throw conflict(
        "This invite was consumed but the resident account is not linked. Ask hostel administration to run onboarding repair and resend activation."
      )
    }

    const state = await this.getExistingUserLinkState(input.authUser, input.invite)

    if (state.status === "linked_to_other_resident") {
      if (!residentIdentityMatches(input.invite, input.resident, state.resident)) {
        throw conflict(
          "This invite was consumed by a different login account. Ask hostel administration to review onboarding access."
        )
      }

      return this.tryRecoverExistingAuthLink({
        invite: input.invite,
        resident: input.resident,
        authUser: input.authUser,
        password: input.password,
        correlationId: input.correlationId,
        requestedIdentity: input.requestedIdentity,
        updatePassword: false,
      }).then((result) => {
        if (!result) {
          throw conflict(
            "This invite was consumed by a different login account. Ask hostel administration to review onboarding access."
          )
        }

        return result
      })
    }

    await this.logActivationTrace("activation_partial_link_recovery_started", "warn", {
      invite: input.invite,
      resident: input.resident,
      authUser: input.authUser,
      correlationId: input.correlationId,
      requestedIdentity: input.requestedIdentity,
      recovery: {
        reason: "used_invite_missing_resident_user_id",
        linkState: state.status,
      },
    })

    const authIdentity = await this.upsertAuthUserForInvite({
      invite: input.invite,
      residentName: input.resident.full_name,
      password: input.password,
      existingAuthUser: input.authUser,
      updatePassword: false,
    })

    try {
      await this.invitesRepository.recoverUsedInviteActivationAtomic({
        inviteId: input.invite.id,
        inviteTokenHash: input.invite.invite_token_hash,
        authUserId: authIdentity.user.id,
      })
    } catch (error) {
      await this.logActivationTrace("activation_partial_link_recovery_failed", "error", {
        invite: input.invite,
        resident: input.resident,
        authUser: authIdentity.user,
        correlationId: input.correlationId,
        requestedIdentity: input.requestedIdentity,
        error,
        recovery: {
          reason: "used_invite_missing_resident_user_id",
        },
      })

      throw mapActivationBootstrapError(error, {
        resident: input.resident,
        invite: input.invite,
        authUser: authIdentity.user,
      })
    }

    await this.syncActivatedPublicProfile({
      invite: input.invite,
      resident: input.resident,
      authIdentity,
    })

    await this.logActivationTrace("activation_partial_link_recovery_completed", "info", {
      invite: input.invite,
      resident: input.resident,
      authUser: authIdentity.user,
      authCreated: false,
      correlationId: input.correlationId,
      requestedIdentity: input.requestedIdentity,
      recovery: {
        reason: "used_invite_missing_resident_user_id",
      },
    })

    await this.publish("resident.invite_used", input.invite, authIdentity.user.id, {
      inviteId: input.invite.id,
      residentId: input.invite.resident_id,
      userId: authIdentity.user.id,
      recovery: "used_invite_missing_resident_link",
    })

    return {
      authenticatedIdentifier: getActivationLoginIdentifier(authIdentity.user, input.invite),
      residentId: input.invite.resident_id,
      redirectTo: AUTH_REDIRECTS.residentOnboarding,
    }
  }

  private async tryRecoverExistingAuthLink(input: {
    invite: ResidentInviteRow
    resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
    authUser: User | null
    password: string
    correlationId: string
    requestedIdentity: ReturnType<typeof getRequestedActivationIdentity>
    updatePassword?: boolean
  }): Promise<ResidentActivationResult | null> {
    if (!input.authUser) {
      return null
    }

    const state = await this.getExistingUserLinkState(input.authUser, input.invite)

    if (state.status === "safe") {
      return null
    }

    if (state.status === "stale_metadata") {
      await this.logActivationTrace("activation_stale_linkage_repaired", "warn", {
        invite: input.invite,
        resident: input.resident,
        authUser: input.authUser,
        correlationId: input.correlationId,
        requestedIdentity: input.requestedIdentity,
        recovery: {
          staleResidentId: state.staleResidentId,
        },
      })

      return null
    }

    const linkedResident = state.resident

    await this.logActivationTrace("activation_recovery_detected", "warn", {
      invite: input.invite,
      resident: input.resident,
      authUser: input.authUser,
      correlationId: input.correlationId,
      requestedIdentity: input.requestedIdentity,
      recovery: {
        linkedResidentId: linkedResident.id,
        linkedResidentStatus: linkedResident.status,
        linkedOnboardingStatus: stringFromRecord(linkedResident, "onboarding_status"),
        identityMatches: residentIdentityMatches(input.invite, input.resident, linkedResident),
      },
    })

    if (!residentIdentityMatches(input.invite, input.resident, linkedResident)) {
      throw conflict(
        "This login account belongs to a different resident identity. Ask hostel administration to merge duplicates or repair auth linkage before retrying."
      )
    }

    assertLinkedResidentCanRecover(linkedResident)

    const recoveryInvite = buildInviteForLinkedResident(input.invite, linkedResident)
    const authIdentity = await this.refreshRecoveredAuthUserForResident({
      invite: recoveryInvite,
      resident: linkedResident,
      password: input.password,
      existingAuthUser: input.authUser,
      updatePassword: input.updatePassword,
    })

    await this.syncActivatedPublicProfile({
      invite: recoveryInvite,
      resident: linkedResident,
      authIdentity,
    })

    const shouldSupersedeInvite =
      input.invite.status === "pending" &&
      !input.invite.used_at &&
      !input.invite.revoked_at

    if (shouldSupersedeInvite) {
      await this.invitesRepository.supersedeForRecoveredIdentity({
        invite: input.invite,
        actorUserId: input.authUser.id,
        linkedResidentId: linkedResident.id,
      })
    }

    await this.logActivationTrace("activation_recovery_completed", "info", {
      invite: recoveryInvite,
      resident: linkedResident,
      authUser: authIdentity.user,
      authCreated: false,
      correlationId: input.correlationId,
      requestedIdentity: input.requestedIdentity,
      recovery: {
        supersededInviteId: shouldSupersedeInvite ? input.invite.id : null,
        linkedResidentId: linkedResident.id,
        inviteStatus: input.invite.status,
      },
    })

    await this.publish("resident.invite_used", recoveryInvite, input.authUser.id, {
      inviteId: input.invite.id,
      residentId: linkedResident.id,
      userId: input.authUser.id,
      recovery: "existing_identity",
    })

    return {
      authenticatedIdentifier: getActivationLoginIdentifier(authIdentity.user, recoveryInvite),
      residentId: linkedResident.id,
      redirectTo: AUTH_REDIRECTS.residentOnboarding,
    }
  }

  private async refreshRecoveredAuthUserForResident(input: {
    invite: ResidentInviteRow
    resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
    password: string
    existingAuthUser: User
    updatePassword?: boolean
  }): Promise<ActivationAuthIdentity> {
    const identity = buildInviteAuthIdentity(input.invite)
    const userMetadata = {
      ...recordFromUnknown(input.existingAuthUser.user_metadata),
      ...buildAuthActivationMetadata(input.invite, input.resident.full_name, identity),
      activation_recovery: "existing_linked_resident",
    }
    const payload: Parameters<typeof this.db.auth.admin.updateUserById>[1] = {
      user_metadata: userMetadata,
    }

    if (input.updatePassword !== false) {
      payload.password = input.password
    }

    if (identity.authEmail) {
      payload.email = identity.authEmail
      payload.email_confirm = true
    }

    if (identity.phone) {
      payload.phone = identity.phone
      payload.phone_confirm = true
    }

    logAuthIdentityPayload("resident_invite_recovery_update", identity, payload)

    const { data, error } = await this.db.auth.admin.updateUserById(
      input.existingAuthUser.id,
      payload
    )

    if (error || !data.user) {
      mapAuthIdentityError(error?.message, identity, "update")
    }

    return {
      user: data.user,
      created: false,
      loginEmail: identity.authEmail,
      internalAuthEmail: identity.internalAuthEmail,
      identityMode: identity.mode,
    }
  }

  private async syncActivatedPublicProfile(input: {
    invite: ResidentInviteRow
    resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
    authIdentity: ActivationAuthIdentity
  }) {
    const existingProfile = await this.usersRepository.getById(input.authIdentity.user.id)
    const metadata = {
      ...recordFromUnknown(existingProfile?.metadata),
      auth_login_email: input.authIdentity.loginEmail,
      internal_auth_email: input.authIdentity.internalAuthEmail,
      resident_identity_mode: input.authIdentity.identityMode,
      resident_id: input.invite.resident_id,
      hostel_id: input.invite.hostel_id,
      last_resident_activation_at: new Date().toISOString(),
    }

    await this.usersRepository.updateProfile(input.authIdentity.user.id, {
      full_name: input.resident.full_name,
      email: normalizeEmail(input.invite.email) ?? null,
      phone: normalizeOptionalPhoneNumber(input.invite.phone) ?? null,
      organization_id: input.invite.organization_id,
      default_role: "resident",
      is_active: true,
      metadata: metadata as Json,
      updated_by: input.authIdentity.user.id,
    })
  }

  private assertResidentCanStartActivation(input: {
    invite: ResidentInviteRow
    resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
    authUser: User | null
  }) {
    const residentStatus = stringFromRecord(input.resident, "status")
    const onboardingStatus = stringFromRecord(input.resident, "onboarding_status")
    const residentUserId = stringFromRecord(input.resident, "user_id")
    const deletedAt = stringFromRecord(input.resident, "deleted_at")
    const checkoutOn = stringFromRecord(input.resident, "checkout_on")

    if (deletedAt) {
      throw conflict(
        "This resident record was archived before activation. Ask hostel administration to restore the resident or create a fresh admission."
      )
    }

    if (residentStatus === "suspended" || onboardingStatus === "suspended") {
      throw conflict(
        "Resident access is suspended. Ask hostel administration to reactivate onboarding before using this invite."
      )
    }

    if (residentStatus === "checked_out" || residentStatus === "archived" || checkoutOn) {
      throw conflict(
        "This resident has already left or been archived. Ask hostel administration to reopen onboarding before activation."
      )
    }

    if (residentUserId && input.authUser && residentUserId !== input.authUser.id) {
      throw conflict(
        "This resident is linked to a different login account. Ask hostel administration to repair auth linkage before activation."
      )
    }

    if (residentUserId && !input.authUser) {
      throw conflict(
        "This resident has a login link but the auth identity cannot be found. Ask hostel administration to rebuild auth linkage."
      )
    }

    if (onboardingStatus === "verified" && !residentUserId) {
      throw conflict(
        "This resident is marked verified but portal access is missing. Ask hostel administration to run onboarding repair before activation."
      )
    }

    if (
      onboardingStatus &&
      ![
        "invited",
        "activated",
        "profile_incomplete",
        "documents_pending",
        "verification_pending",
        "rejected",
      ].includes(onboardingStatus)
    ) {
      throw conflict(
        `Resident onboarding is in ${humanizeActivationState(onboardingStatus)} state. Ask hostel administration to repair onboarding and resend activation.`
      )
    }
  }

  private async logActivationTrace(
    stage:
      | "preflight"
      | "auth_identity_race_recovered"
      | "auth_identity_ready"
      | "activation_replay_detected"
      | "activation_replay_link_recovered"
      | "activation_recovery_detected"
      | "activation_recovery_completed"
      | "activation_stale_linkage_repaired"
      | "activation_partial_link_recovery_started"
      | "activation_partial_link_recovery_failed"
      | "activation_partial_link_recovery_completed"
      | "bootstrap_failed"
      | "bootstrap_completed",
    level: "info" | "warn" | "error",
    input: {
      invite: ResidentInviteRow
      resident: Awaited<ReturnType<ResidentsRepository["getById"]>>
      authUser?: User | null
      authCreated?: boolean
      correlationId?: string
      requestedIdentity?: { email?: string; phone?: string }
      error?: unknown
      recovery?: Record<string, unknown>
    }
  ) {
    try {
      const duplicateSummary = await this.getActiveInviteSummary(input.invite)
      const publicProfile = input.resident?.user_id
        ? await this.usersRepository.getById(input.resident.user_id)
        : null
      const metadata = {
        stage,
        correlationId: input.correlationId,
        invite: {
          id: input.invite.id,
          status: input.invite.status,
          usedAt: input.invite.used_at,
          revokedAt: input.invite.revoked_at,
          expiresAt: input.invite.expires_at,
          expired: new Date(input.invite.expires_at).getTime() <= Date.now(),
          identityMode: getResidentIdentityMode(input.invite),
          duplicateActiveInvites: duplicateSummary.activeCount,
          duplicateActiveInviteIds: duplicateSummary.activeInviteIds,
        },
        resident: input.resident
          ? {
              id: input.resident.id,
              status: stringFromRecord(input.resident, "status"),
              onboardingStatus: stringFromRecord(input.resident, "onboarding_status"),
              userId: stringFromRecord(input.resident, "user_id"),
              deletedAt: stringFromRecord(input.resident, "deleted_at"),
              checkoutOn: stringFromRecord(input.resident, "checkout_on"),
              isActive: Boolean(input.resident.is_active),
              identityMode: getResidentIdentityMode(input.resident),
            }
          : null,
        auth: {
          exists: Boolean(input.authUser),
          userId: input.authUser?.id ?? null,
          createdDuringAttempt: input.authCreated ?? false,
          publicProfileExists: Boolean(publicProfile),
          publicProfileOrganizationId: publicProfile?.organization_id ?? null,
        },
        requestedIdentity: {
          emailProvided: Boolean(input.requestedIdentity?.email),
          phoneProvided: Boolean(input.requestedIdentity?.phone),
        },
        error: input.error instanceof Error
          ? {
              name: input.error.name,
              message: input.error.message,
            }
          : input.error
            ? { message: String(input.error) }
            : null,
        recovery: input.recovery ?? null,
      }
      const event = {
        event: "resident_invite.activation_trace",
        message: `Resident activation ${stage}.`,
        organizationId: input.invite.organization_id,
        userId: input.authUser?.id ?? null,
        metadata,
      }

      if (level === "error") {
        logger.error(event)
      } else if (level === "warn") {
        logger.warn(event)
      } else {
        logger.info(event)
      }
    } catch (traceError) {
      logger.warn({
        event: "resident_invite.activation_trace_failed",
        message: "Activation trace logging failed.",
        organizationId: input.invite.organization_id,
        metadata: {
          stage,
          correlationId: input.correlationId,
          inviteId: input.invite.id,
          error: traceError instanceof Error ? traceError.message : String(traceError),
        },
      })
    }
  }

  private async getActiveInviteSummary(invite: ResidentInviteRow) {
    const invites = await this.invitesRepository.listForResident(
      invite.organization_id,
      invite.resident_id
    )
    const now = Date.now()
    const activeInvites = invites.filter((candidate) => {
      return (
        candidate.status === "pending" &&
        !candidate.used_at &&
        !candidate.revoked_at &&
        new Date(candidate.expires_at).getTime() > now
      )
    })

    return {
      activeCount: activeInvites.length,
      activeInviteIds: activeInvites.map((candidate) => candidate.id).slice(0, 5),
    }
  }

  private async sendInviteEmail(input: {
    invite: ResidentInviteRow
    residentName: string
    activationLink: string | null
    deliveryChannel: string
  }) {
    if (!input.invite.email || input.deliveryChannel !== "email" || !input.activationLink) {
      return
    }

    await this.emailQueue.sendTemplate({
      to: input.invite.email,
      title: "Activate your resident portal",
      body:
        `Hello ${input.residentName}, your Sadhana Boys Hostel resident portal access is ready. ` +
        "Use the secure link before it expires.",
      templateKey: "resident_onboarding",
      payload: {
        portal_url: input.activationLink,
        invite_code: input.invite.invite_code,
        expires_at: input.invite.expires_at,
      },
      organizationId: input.invite.organization_id,
      idempotencyKey: `resident-invite-${input.invite.id}`,
    })
  }

  private publish(
    type:
      | "resident.invite_created"
      | "resident.invite_resent"
      | "resident.invite_revoked"
      | "resident.invite_used",
    invite: ResidentInviteRow,
    actorUserId: string | null,
    payload: Json
  ) {
    return this.eventPublisher.publish({
      type,
      organizationId: invite.organization_id,
      hostelId: invite.hostel_id,
      actorUserId,
      payload,
    })
  }
}

function toSafeInvite(invite: ResidentInviteRow, resident: Awaited<ReturnType<ResidentsRepository["getById"]>>): ResidentInviteSafe {
  if (!resident) {
    throw notFound("Resident not found.")
  }
  const identityMode = getResidentIdentityMode({
    email: invite.email ?? resident.email,
    phone: invite.phone ?? resident.phone,
  })
  const requirement = getResidentIdentityRequirement(identityMode)

  return {
    id: invite.id,
    residentId: invite.resident_id,
    organizationId: invite.organization_id,
    hostelId: invite.hostel_id,
    residentName: resident.full_name,
    admissionNumber: resident.admission_number,
    identityMode,
    maskedEmail: maskEmail(invite.email),
    maskedPhone: maskPhone(invite.phone),
    ...requirement,
    authLinked: Boolean(resident.user_id),
    activationState: getActivationState(resident, invite),
    expiresAt: invite.expires_at,
    status: invite.status,
  }
}

function getActivationState(
  resident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>,
  invite: ResidentInviteRow
): ResidentInviteSafe["activationState"] {
  const onboardingStatus = stringFromRecord(resident, "onboarding_status")

  if (resident.status === "suspended" || onboardingStatus === "suspended") {
    return "suspended"
  }

  if (onboardingStatus === "verified") {
    return "verified"
  }

  if (resident.user_id && invite.status === "used") {
    return "auth_linked"
  }

  if (resident.user_id) {
    return "onboarding_pending"
  }

  return "activation_pending"
}

function buildActivationLink(token: string) {
  const baseUrl = getInviteAppBaseUrl()

  return `${baseUrl}/activate?token=${encodeURIComponent(token)}`
}

function buildResidentLoginLink(phone?: string | null) {
  const baseUrl = getInviteAppBaseUrl()
  const params = new URLSearchParams()
  const normalizedPhone = normalizeOptionalPhoneNumber(phone)

  if (normalizedPhone) {
    params.set("phone", normalizedPhone)
  }

  const query = params.toString()

  return `${baseUrl}/resident/login${query ? `?${query}` : ""}`
}

function buildWhatsappShareUrl(input: {
  phone?: string | null
  activationLink: string | null
  loginLink: string
  inviteCode: string
  temporaryPassword: string | null
}) {
  const digits = phoneDigits(input.phone)

  if (!digits || (!input.temporaryPassword && !input.activationLink)) {
    return null
  }

  const message = input.temporaryPassword
    ? `Your Sadhana Boys Hostel resident portal access is ready.\n\n` +
      `Login link:\n${input.loginLink}\n` +
      `Phone: ${input.phone}\n` +
      `Temporary password: ${input.temporaryPassword}\n\n` +
      `Please sign in and set your permanent password during onboarding.`
    : `Your Sadhana Boys Hostel resident portal access is ready.\n\n` +
      `Activation link:\n${input.activationLink}\n` +
      `Invite code: ${input.inviteCode}\n\n` +
      `This link is one-time use.`

  const url = new URL(`https://wa.me/${digits}`)
  url.searchParams.set("text", message)

  return url.toString()
}

function getInviteAppBaseUrl() {
  const env = getServerEnv()
  const configuredUrl = normalizeBaseUrlCandidate(env.NEXT_PUBLIC_APP_URL)
  const vercelProductionUrl = normalizeBaseUrlCandidate(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  const vercelDeploymentUrl = normalizeBaseUrlCandidate(process.env.VERCEL_URL)
  const isProduction =
    env.LAUNCH_MODE === "production" ||
    env.NEXT_PUBLIC_LAUNCH_MODE === "production" ||
    process.env.VERCEL_ENV === "production"
  const isVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_URL)

  if (configuredUrl && !isLocalOrPlaceholderAppUrl(configuredUrl)) {
    return configuredUrl
  }

  if (vercelProductionUrl) {
    return vercelProductionUrl
  }

  if (isVercel && vercelDeploymentUrl) {
    return vercelDeploymentUrl
  }

  if (isProduction) {
    throw new Error(
      "Cannot create resident invite links: configure NEXT_PUBLIC_APP_URL with the production domain or enable Vercel system environment variables."
    )
  }

  return configuredUrl ?? LOCAL_APP_URL
}

function normalizeBaseUrlCandidate(value?: string | null) {
  const rawValue = value?.trim()

  if (!rawValue) {
    return null
  }

  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`

  try {
    const url = new URL(withProtocol)

    return url.origin.replace(/\/$/, "")
  } catch {
    return null
  }
}

function isLocalOrPlaceholderAppUrl(value: string) {
  const hostname = new URL(value).hostname.toLowerCase()

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.includes("example.com") ||
    hostname.includes("placeholder")
  )
}

function generateTemporaryPassword() {
  return `Sbh-${randomBytes(9).toString("base64url")}!7`
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || undefined
}

function normalizeInviteCode(inviteCode?: string) {
  const value = inviteCode?.trim().toUpperCase()

  if (!value) {
    throw badRequest("Invite code is required.")
  }

  return value
}

function residentIdentityMatches(
  invite: ResidentInviteRow,
  targetResident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>,
  linkedResident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
) {
  const inviteEmail = normalizeEmail(invite.email)
  const targetEmail = normalizeEmail(targetResident.email)
  const linkedEmail = normalizeEmail(linkedResident.email)

  const phoneMatches = Boolean(
    linkedResident.phone &&
      (phoneNumbersMatch(linkedResident.phone, invite.phone) ||
        phoneNumbersMatch(linkedResident.phone, targetResident.phone))
  )
  const emailMatches = Boolean(
    linkedEmail && (linkedEmail === inviteEmail || linkedEmail === targetEmail)
  )

  return phoneMatches || emailMatches
}

function assertLinkedResidentCanRecover(
  linkedResident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
) {
  const status = stringFromRecord(linkedResident, "status")
  const onboardingStatus = stringFromRecord(linkedResident, "onboarding_status")
  const checkoutOn = stringFromRecord(linkedResident, "checkout_on")

  if (status === "suspended" || onboardingStatus === "suspended") {
    throw conflict(
      "This phone is linked to a suspended resident account. Ask hostel administration to reactivate or repair that account before retrying."
    )
  }

  if (status === "checked_out" || status === "archived" || checkoutOn) {
    throw conflict(
      "This phone is linked to a resident account that already left or was archived. Ask hostel administration to reopen or merge the resident record before retrying."
    )
  }
}

function buildInviteForLinkedResident(
  invite: ResidentInviteRow,
  linkedResident: NonNullable<Awaited<ReturnType<ResidentsRepository["getById"]>>>
): ResidentInviteRow {
  return {
    ...invite,
    organization_id: linkedResident.organization_id,
    hostel_id: linkedResident.hostel_id,
    resident_id: linkedResident.id,
    email: linkedResident.email ?? invite.email,
    phone: linkedResident.phone ?? invite.phone,
  }
}

function buildInviteAuthIdentity(invite: ResidentInviteRow): InviteAuthIdentity {
  const email = normalizeEmail(invite.email)
  const phone = normalizeResidentInvitePhone(invite.phone)
  const internalAuthEmail = !email
    ? buildResidentInternalAuthEmail(invite.resident_id)
    : undefined

  if (!email && !phone) {
    throw badRequest("Resident needs a phone number or email before portal access can be activated.")
  }

  return {
    email,
    phone,
    authEmail: email ?? internalAuthEmail,
    internalAuthEmail,
    mode: email && phone ? "email_and_phone" : email ? "email" : "phone",
  }
}

function normalizeResidentInvitePhone(phone?: string | null) {
  try {
    return normalizeOptionalPhoneNumber(phone)
  } catch (error) {
    if (error instanceof PhoneNormalizationError) {
      throw badRequest(
        "This resident phone number is not valid for portal access. Ask the admin to correct it and resend activation."
      )
    }

    throw error
  }
}

function getActivationLoginIdentifier(authUser: User, invite: ResidentInviteRow) {
  const metadata = recordFromUnknown(authUser.user_metadata)
  const internalAuthEmail = normalizeEmail(
    typeof metadata.internal_auth_email === "string"
      ? metadata.internal_auth_email
      : undefined
  )
  const authEmail = normalizeEmail(authUser.email)

  if (authEmail && authEmail !== internalAuthEmail) {
    return authEmail
  }

  return (
    normalizeOptionalPhoneNumber(invite.phone) ??
    normalizeOptionalPhoneNumber(authUser.phone) ??
    normalizeEmail(invite.email) ??
    authEmail ??
    ""
  )
}

function buildAuthActivationMetadata(
  invite: ResidentInviteRow,
  residentName: string,
  identity: InviteAuthIdentity
) {
  const inviteMetadata = recordFromUnknown(invite.metadata)
  const accessMode = inviteMetadata.access_mode === "temporary_password"
    ? "temporary_password"
    : "activation_link"

  return {
    full_name: residentName,
    organization_id: invite.organization_id,
    hostel_id: invite.hostel_id,
    resident_id: invite.resident_id,
    resident_identity_mode: identity.mode,
    auth_login_email: identity.authEmail,
    internal_auth_email: identity.internalAuthEmail,
    phone_password_login_strategy: identity.internalAuthEmail
      ? "internal_email_alias"
      : "direct_email",
    activated_from_invite: true,
    resident_access_mode: accessMode,
    temporary_password_active: accessMode === "temporary_password",
    temporary_password_expires_at:
      accessMode === "temporary_password" &&
      typeof inviteMetadata.temporary_password_expires_at === "string"
        ? inviteMetadata.temporary_password_expires_at
        : undefined,
  }
}

function logAuthIdentityPayload(
  mode:
    | "resident_invite_create"
    | "resident_invite_update"
    | "resident_invite_recovery_update",
  identity: InviteAuthIdentity,
  payload: object
) {
  logger.info({
    event: "auth.identity_payload",
    message: "Resident activation auth provider payload prepared.",
    metadata: {
      mode,
      identityMode: identity.mode,
      normalizedPhone: identity.phone,
      normalizedEmail: identity.email,
      authEmailStrategy: identity.internalAuthEmail ? "internal_alias" : "direct_email",
      providerPayload: sanitizeAuthProviderPayload(payload),
    },
  })
}

function sanitizeAuthProviderPayload(payload: object) {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (key === "password") {
      sanitized[key] = "REDACTED"
    } else if (key === "email") {
      sanitized[key] = typeof value === "string" ? maskEmail(value) : value
    } else if (key === "phone") {
      sanitized[key] = typeof value === "string" ? maskPhone(value) : value
    } else if (key === "user_metadata") {
      sanitized[key] = "[metadata]"
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

function isDuplicateAuthIdentityError(message: string | undefined, identity: InviteAuthIdentity) {
  const normalized = message?.toLowerCase() ?? ""

  if (
    identity.phone &&
    normalized.includes("phone") &&
    (normalized.includes("already") ||
      normalized.includes("registered") ||
      normalized.includes("unique") ||
      normalized.includes("duplicate"))
  ) {
    return true
  }

  if (
    identity.email &&
    normalized.includes("email") &&
    (normalized.includes("already") ||
      normalized.includes("registered") ||
      normalized.includes("unique") ||
      normalized.includes("duplicate"))
  ) {
    return true
  }

  return false
}

function mapAuthIdentityError(
  message: string | undefined,
  identity: InviteAuthIdentity,
  operation: "create" | "update"
): never {
  const normalized = message?.toLowerCase() ?? ""

  if (
    identity.phone &&
    normalized.includes("phone") &&
    (normalized.includes("already") ||
      normalized.includes("registered") ||
      normalized.includes("unique") ||
      normalized.includes("duplicate"))
  ) {
    throw conflict(
      "This phone number already has portal access. Ask the admin to resend activation or run auth linkage repair for this resident."
    )
  }

  if (
    identity.email &&
    normalized.includes("email") &&
    (normalized.includes("already") ||
      normalized.includes("registered") ||
      normalized.includes("unique") ||
      normalized.includes("duplicate"))
  ) {
    throw conflict(
      "This email already has portal access. Ask the admin to resend activation or run auth linkage repair for this resident."
    )
  }

  if (identity.phone && normalized.includes("phone") && normalized.includes("invalid")) {
    throw badRequest(
      "This resident phone number is not valid for portal activation. Ask the admin to correct the phone number and resend access."
    )
  }

  if (identity.email && normalized.includes("email") && normalized.includes("invalid")) {
    throw badRequest(
      "This resident email is not valid for portal activation. Ask the admin to correct the email and resend access."
    )
  }

  if (
    normalized.includes("phone provider") ||
    normalized.includes("sms") ||
    normalized.includes("provider")
  ) {
    throw forbidden(
      "Phone activation is not available in this environment. Ask the admin to enable phone auth or use an email invite."
    )
  }

  throw forbidden(
    operation === "create"
      ? "Auth user creation failed. Ask the hostel admin to verify resident phone/email details and resend activation."
      : "Auth user update failed. Ask the hostel admin to run auth linkage repair and resend activation."
  )
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

function getRequestedActivationIdentity(input: { email?: string; phone?: string }) {
  return {
    email: normalizeEmail(input.email),
    phone: normalizeOptionalPhoneNumber(input.phone),
  }
}

function humanizeActivationState(value: string) {
  return value.replace(/_/g, " ")
}

function inviteAlreadyUsedConflict(): never {
  throw conflict(
    "This invite was already used. Sign in with your resident account or ask the hostel office to resend access.",
    { reason: "invite_already_used" }
  )
}

function mapActivationBootstrapError(
  error: unknown,
  context?: {
    resident?: Awaited<ReturnType<ResidentsRepository["getById"]>>
    invite?: ResidentInviteRow
    authUser?: User
  }
): never {
  const message = error instanceof RepositoryError ? error.message : String(error)
  const code = error instanceof RepositoryError ? error.code : undefined

  if (message.includes("invite_not_found") || message.includes("Invalid invite token")) {
    throw unauthorized("Invalid or expired invite.")
  }

  if (message.includes("activation_arguments_required")) {
    throw badRequest("Activation request is incomplete. Open the latest invite link and try again.")
  }

  if (message.includes("invite_expired")) {
    throw conflict("This invite has expired. Ask the hostel admin to resend access.")
  }

  if (message.includes("invite_already_used")) {
    throw inviteAlreadyUsedConflict()
  }

  if (message.includes("resident_already_linked")) {
    throw conflict("This resident profile is already linked to another login account.")
  }

  if (message.includes("auth_user_linked_to_other_resident")) {
    throw conflict(
      "This login account is linked to another resident. Use Identity Repair to merge duplicates or reset the stale auth linkage before retrying."
    )
  }

  if (message.includes("auth_identity_tenant_mismatch")) {
    throw forbidden(
      "This login account belongs to a different organization. Ask administration to verify the resident phone/email before retrying."
    )
  }

  if (message.includes("resident_activation_blocked_status")) {
    const state = message.split(":").at(-1)?.replace(/[^a-z_]/gi, "") || "inactive"

    throw conflict(
      `Resident activation is blocked because the resident is ${humanizeActivationState(state)}. Reactivate or reopen onboarding from the admin panel before resending access.`
    )
  }

  if (message.includes("resident_activation_blocked_onboarding_status")) {
    const state = message.split(":").at(-1)?.replace(/[^a-z_]/gi, "") || "not ready"

    throw conflict(
      `Resident activation is blocked because onboarding is ${humanizeActivationState(state)}. Run onboarding repair or resume onboarding from the admin panel before retrying.`
    )
  }

  if (message.includes("resident_activation_checked_out")) {
    throw conflict(
      "This resident has already left. Reopen the resident lifecycle from the admin panel before activation."
    )
  }

  if (message.includes("resident_activation_deleted")) {
    throw conflict(
      "This resident record is archived. Restore the resident or create a fresh admission before activation."
    )
  }

  if (message.includes("invite_identity_mismatch")) {
    throw forbidden("Invite identity does not match this resident record. Ask the hostel admin to resend activation for the correct phone or email.")
  }

  if (message.includes("auth_user_not_found")) {
    throw forbidden("Unable to finish activation because the login account was not created.")
  }

  if (message.includes("resident_not_found")) {
    throw notFound("Resident not found.")
  }

  if (message.includes("Invalid resident activation bootstrap update")) {
    const residentStatus = context?.resident
      ? stringFromRecord(context.resident, "status")
      : null
    const onboardingStatus = context?.resident
      ? stringFromRecord(context.resident, "onboarding_status")
      : null
    const residentUserId = context?.resident
      ? stringFromRecord(context.resident, "user_id")
      : null
    const authUserId = context?.authUser?.id ?? null

    if (residentStatus === "suspended" || onboardingStatus === "suspended") {
      throw conflict(
        "Activation is blocked because this resident is suspended. Reactivate onboarding from the admin panel before retrying."
      )
    }

    if (residentStatus === "checked_out" || residentStatus === "archived") {
      throw conflict(
        "Activation is blocked because this resident has exited the hostel. Reopen the resident lifecycle before retrying."
      )
    }

    if (residentUserId && authUserId && residentUserId !== authUserId) {
      throw conflict(
        "Activation found a different linked login account. Run auth linkage repair before retrying."
      )
    }

    throw conflict(
      "Activation was blocked by resident lifecycle validation. Ask the admin to run onboarding repair, then resend activation."
    )
  }

  if (
    code === "23505" ||
    message.includes("duplicate key value") ||
    message.includes("unique constraint")
  ) {
    if (message.includes("users_email")) {
      throw conflict(
        "This email is already linked to another portal account. Ask the admin to repair the resident auth linkage before activating."
      )
    }

    if (message.includes("phone")) {
      throw conflict(
        "This phone number is already linked to another portal account. Ask the admin to repair the resident auth linkage before activating."
      )
    }

    throw conflict(
      "Activation found a duplicate account link. Ask the admin to run onboarding repair and resend activation."
    )
  }

  if (
    code === "23503" ||
    message.includes("foreign key") ||
    message.includes("violates foreign key constraint")
  ) {
    throw conflict(
      "Activation could not link the resident account because related profile records are missing. Ask the admin to run auth linkage repair."
    )
  }

  if (
    code === "23514" ||
    message.includes("check constraint")
  ) {
    throw conflict(
      "Activation was blocked by resident lifecycle validation. Ask the admin to review onboarding state and resend activation."
    )
  }

  if (code === "42501" || message.includes("permission denied")) {
    throw forbidden(
      "Activation was blocked by security policy. Ask the admin to run auth linkage repair and retry activation."
    )
  }

  throw conflict(
    "Activation could not finish safely. Ask the hostel admin to run onboarding repair and resend activation."
  )
}
