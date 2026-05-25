import "server-only"

import { randomBytes } from "node:crypto"

import type { User } from "@supabase/supabase-js"

import { AUTH_REDIRECTS } from "@/constants/auth"
import { getServerEnv } from "@/config/env"
import { badRequest, conflict, forbidden, notFound, unauthorized } from "@/lib/api/api-error"
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

type ResidentInviteServiceDependencies = {
  authService?: AuthService
  residentsRepository?: ResidentsRepository
  usersRepository?: UsersRepository
  invitesRepository?: ResidentInvitesRepository
  activationService?: Pick<ResidentInviteService, "activateInvite">
  eventPublisher?: Pick<RealtimeEventPublisher, "publish">
  emailQueue?: Pick<EmailQueueService, "sendTemplate">
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
      phone: resident.phone,
      invite_code: inviteCode,
      invite_token_hash: hashInviteToken(token),
      expires_at: expiresAt.toISOString(),
      invited_by: context.authUser.id,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
      metadata: {
        delivery_channel: values.deliveryChannel,
        permissions: DEFAULT_INVITE_PERMISSIONS,
      } satisfies Json,
    })
    const loginLink = buildResidentLoginLink(resident.phone)
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
      phone: resident.phone,
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
    const invite = await this.resolveUsableInvite(values)
    const resident = await this.getResidentForInvite(invite.organization_id, invite.resident_id)

    const authUser = await this.upsertAuthUserForInvite({
      invite,
      residentName: resident.full_name,
      password: values.password,
    })

    await this.assertExistingUserIsSafe(authUser, invite)

    try {
      await this.invitesRepository.activateInviteAtomic({
        inviteId: invite.id,
        inviteTokenHash: invite.invite_token_hash,
        authUserId: authUser.id,
      })
    } catch (error) {
      throw mapActivationBootstrapError(error)
    }

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
      authenticatedIdentifier: authUser.email ?? authUser.phone ?? invite.phone ?? invite.email ?? "",
      residentId: invite.resident_id,
      redirectTo: AUTH_REDIRECTS.residentOnboarding,
    }
  }

  async expireDueInvites(input: { organizationId?: string; hostelId?: string; limit?: number }) {
    return this.invitesRepository.expireDue(input)
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
          phone: normalizePhone(input.phone),
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
    const normalizedPhone = normalizePhone(phone)

    if (
      normalizedEmail &&
      invite.email &&
      normalizedEmail === normalizeEmail(invite.email)
    ) {
      return
    }

    if (
      normalizedPhone &&
      invite.phone &&
      normalizedPhone === normalizePhone(invite.phone)
    ) {
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
  }) {
    const existing = await this.findAuthUserForInvite(input.invite)

    if (existing) {
      await this.assertExistingUserIsSafe(existing, input.invite)

      const { data, error } = await this.db.auth.admin.updateUserById(existing.id, {
        email: input.invite.email ?? undefined,
        phone: normalizePhoneForAuth(input.invite.phone),
        password: input.password,
        email_confirm: Boolean(input.invite.email),
        phone_confirm: Boolean(input.invite.phone),
        user_metadata: {
          full_name: input.residentName,
          organization_id: input.invite.organization_id,
          activated_from_invite: true,
        },
      })

      if (error || !data.user) {
        throw forbidden(error?.message ?? "Unable to update auth user for activation.")
      }

      return data.user
    }

    const { data, error } = await this.db.auth.admin.createUser({
      email: input.invite.email ?? undefined,
      phone: normalizePhoneForAuth(input.invite.phone),
      password: input.password,
      email_confirm: Boolean(input.invite.email),
      phone_confirm: Boolean(input.invite.phone),
      user_metadata: {
        full_name: input.residentName,
        organization_id: input.invite.organization_id,
        activated_from_invite: true,
      },
    })

    if (error || !data.user) {
      throw forbidden(error?.message ?? "Unable to create auth user for activation.")
    }

    return data.user
  }

  private async findAuthUserForInvite(invite: ResidentInviteRow) {
    const normalizedEmail = normalizeEmail(invite.email)
    const normalizedPhone = normalizePhone(invite.phone)

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
          (normalizedPhone && phoneNumbersMatch(candidate.phone, invite.phone))
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

  private async assertExistingUserIsSafe(user: User, invite: ResidentInviteRow) {
    const profile = await this.usersRepository.getById(user.id)

    if (!profile) {
      return
    }

    if (profile.organization_id && profile.organization_id !== invite.organization_id) {
      throw forbidden("This login account belongs to another organization.")
    }

    const linkedResident = await this.residentsRepository.getByUserId(
      user.id,
      invite.organization_id
    )

    if (linkedResident && linkedResident.id !== invite.resident_id) {
      throw conflict("This login account is already linked to another resident.")
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

  return {
    id: invite.id,
    residentId: invite.resident_id,
    organizationId: invite.organization_id,
    hostelId: invite.hostel_id,
    residentName: resident.full_name,
    admissionNumber: resident.admission_number,
    maskedEmail: maskEmail(invite.email),
    maskedPhone: maskPhone(invite.phone),
    expiresAt: invite.expires_at,
    status: invite.status,
  }
}

function buildActivationLink(token: string) {
  const baseUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")

  return `${baseUrl}/activate?token=${encodeURIComponent(token)}`
}

function buildResidentLoginLink(phone: string | null) {
  const baseUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  const params = new URLSearchParams()

  if (phone) {
    params.set("phone", phone)
  }

  const query = params.toString()

  return `${baseUrl}/resident/login${query ? `?${query}` : ""}`
}

function buildWhatsappShareUrl(input: {
  phone: string | null
  activationLink: string | null
  loginLink: string
  inviteCode: string
  temporaryPassword: string | null
}) {
  const digits = input.phone?.replace(/\D/g, "")

  if (!digits) {
    return null
  }

  const message = input.temporaryPassword
    ? `Your Sadhana Boys Hostel resident portal access is ready.\n\n` +
      `Login: ${input.loginLink}\n` +
      `Phone: ${input.phone}\n` +
      `Temporary password: ${input.temporaryPassword}\n\n` +
      `Please sign in and set your permanent password during onboarding.`
    : `Your Sadhana Boys Hostel resident portal access is ready.\n\n` +
      `Activate: ${input.activationLink}\n` +
      `Invite code: ${input.inviteCode}\n\n` +
      `This link is one-time use.`

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function generateTemporaryPassword() {
  return `Sbh-${randomBytes(9).toString("base64url")}!7`
}

function normalizePhoneForAuth(phone?: string | null) {
  const trimmed = phone?.trim()

  if (!trimmed) {
    return undefined
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.replace(/\D/g, "")}`
  }

  const digits = trimmed.replace(/\D/g, "")

  if (digits.length === 10) {
    return `+91${digits}`
  }

  return `+${digits}`
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || undefined
}

function normalizePhone(phone?: string | null) {
  return phone?.replace(/\D/g, "") || undefined
}

function phoneNumbersMatch(left?: string | null, right?: string | null) {
  const leftDigits = normalizePhone(left)
  const rightDigits = normalizePhone(right)

  if (!leftDigits || !rightDigits) {
    return false
  }

  return (
    leftDigits === rightDigits ||
    (leftDigits.length >= 10 &&
      rightDigits.length >= 10 &&
      leftDigits.slice(-10) === rightDigits.slice(-10))
  )
}

function normalizeInviteCode(inviteCode?: string) {
  const value = inviteCode?.trim().toUpperCase()

  if (!value) {
    throw badRequest("Invite code is required.")
  }

  return value
}

function mapActivationBootstrapError(error: unknown): never {
  const message = error instanceof RepositoryError ? error.message : String(error)

  if (message.includes("invite_not_found") || message.includes("Invalid invite token")) {
    throw unauthorized("Invalid or expired invite.")
  }

  if (message.includes("invite_expired")) {
    throw conflict("This invite has expired. Ask the hostel admin to resend access.")
  }

  if (message.includes("invite_already_used")) {
    throw conflict("This invite was already used. Sign in with your resident account or ask the hostel office to resend access.")
  }

  if (message.includes("resident_already_linked")) {
    throw conflict("This resident profile is already linked to another login account.")
  }

  if (message.includes("invite_identity_mismatch")) {
    throw forbidden("Invite identity does not match this resident record.")
  }

  if (message.includes("auth_user_not_found")) {
    throw forbidden("Unable to finish activation because the login account was not created.")
  }

  if (message.includes("resident_not_found")) {
    throw notFound("Resident not found.")
  }

  throw error
}
