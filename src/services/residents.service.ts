import "server-only"

import { randomBytes, randomUUID } from "node:crypto"

import { anyRoleHasPermission } from "@/constants/auth"
import { getServerEnv } from "@/config/env"
import { HOSTEL_FEES } from "@/constants/hostel"
import { conflict, forbidden } from "@/lib/api/api-error"
import { logAuditEvent, logger } from "@/lib/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OperationsRepository } from "@/repositories/operations.repository"
import { PaymentsRepository, type PaymentRow } from "@/repositories/payments.repository"
import { ResidentsRepository, type ResidentWithOnboarding } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UsersRepository } from "@/repositories/users.repository"
import type { ResidentInviteCreated } from "@/types/invites"
import type { ResidentCreateResult, ResidentPasswordResetResult } from "@/types/residents"
import { RealtimeEventPublisher } from "@/services/realtime/event-publisher"
import type { RealtimeEventType } from "@/services/realtime/event-types"
import { RealtimeService } from "@/services/realtime/realtime.service"
import { InvoicesService } from "@/services/invoices"
import {
  checkoutResidentSchema,
  createResidentSchema,
  repairResidentLifecycleSchema,
  residentIdMutationSchema,
  residentListSchema,
  updateOwnResidentProfileSchema,
  updateResidentSchema,
} from "@/validations/resident.validation"

import { assertFound, AuthService } from "./auth.service"
import { ResidentInviteService } from "./invites"

type ResidentsServiceDependencies = {
  authService?: AuthService
  residentsRepository?: ResidentsRepository
  residentInviteService?: Pick<ResidentInviteService, "createResidentInvite">
  operationsRepository?: Pick<OperationsRepository, "repairResidentLifecycle">
  realtimeService?: Pick<RealtimeService, "paymentStatusChanged" | "dashboardRefresh">
  invoicesService?: Pick<
    InvoicesService,
    "generatePaymentReceiptInvoice" | "generateVerifiedMonthlyFeePaymentInvoice"
  >
  paymentsRepository?: Pick<
    PaymentsRepository,
    | "create"
    | "createFeeRecord"
    | "findByIdempotencyKey"
    | "findFeeRecordByResidentPeriod"
    | "getById"
    | "updateInvoiceLink"
    | "updateFeeRecord"
  >
}

export class ResidentsService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository
  private readonly residentInviteService: Pick<ResidentInviteService, "createResidentInvite">
  private readonly operationsRepository: Pick<OperationsRepository, "repairResidentLifecycle">
  private readonly realtimeService: Pick<RealtimeService, "paymentStatusChanged" | "dashboardRefresh">
  private readonly invoicesService: Pick<
    InvoicesService,
    "generatePaymentReceiptInvoice" | "generateVerifiedMonthlyFeePaymentInvoice"
  >
  private readonly paymentsRepository: Pick<
    PaymentsRepository,
    | "create"
    | "createFeeRecord"
    | "findByIdempotencyKey"
    | "findFeeRecordByResidentPeriod"
    | "getById"
    | "updateInvoiceLink"
    | "updateFeeRecord"
  >

  constructor(
    private readonly db: AppSupabaseClient,
    dependencies: ResidentsServiceDependencies = {}
  ) {
    this.authService = dependencies.authService ?? new AuthService(db)
    this.residentsRepository = dependencies.residentsRepository ?? new ResidentsRepository(db)
    this.residentInviteService =
      dependencies.residentInviteService ??
      new ResidentInviteService(db, {
        authService: this.authService,
        residentsRepository: this.residentsRepository,
      })
    this.operationsRepository = dependencies.operationsRepository ?? new OperationsRepository(db)
    this.realtimeService = dependencies.realtimeService ?? new RealtimeService(db)
    this.invoicesService = dependencies.invoicesService ?? new InvoicesService(db)
    this.paymentsRepository = dependencies.paymentsRepository ?? new PaymentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ResidentsService(db)
  }

  async listResidents(input: unknown) {
    const values = residentListSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.residentsRepository.list({
      ...values,
      ...(hostelId ? { hostelId } : {}),
    })
  }

  async resetResidentTemporaryPassword(input: unknown): Promise<ResidentPasswordResetResult> {
    const values = residentIdMutationSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")
    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    if (!resident.user_id) {
      throw conflict("Resident portal account is not active yet. Generate an invite first.")
    }

    const adminDb = createSupabaseAdminClient()
    const usersRepository = new UsersRepository(adminDb)
    const profile = await usersRepository.getById(resident.user_id)
    const { data: authUserResult, error: authUserError } =
      await adminDb.auth.admin.getUserById(resident.user_id)

    if (authUserError || !authUserResult.user) {
      throw forbidden(authUserError?.message ?? "Resident auth account could not be loaded.")
    }

    const temporaryPassword = generateTemporaryPassword()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const authMetadata = {
      ...recordFromUnknown(authUserResult.user.user_metadata),
      force_password_reset: true,
      temporary_password_active: true,
      temporary_password_expires_at: expiresAt,
      resident_password_reset_by_admin: true,
    }
    const { error } = await adminDb.auth.admin.updateUserById(resident.user_id, {
      password: temporaryPassword,
      user_metadata: authMetadata,
    })

    if (error) {
      throw forbidden(error.message)
    }

    if (profile) {
      await usersRepository.updateProfile(resident.user_id, {
        metadata: {
          ...recordFromUnknown(profile.metadata),
          force_password_reset: true,
          temporary_password_active: true,
          temporary_password_expires_at: expiresAt,
          resident_password_reset_by_admin: true,
        },
        updated_by: context.authUser.id,
      })
    }

    await this.publishResidentEvent("resident.updated", resident, context.authUser.id)
    logAuditEvent({
      action: "resident.password_reset",
      actorUserId: context.authUser.id,
      organizationId: resident.organization_id,
      targetTable: "residents",
      targetId: resident.id,
      outcome: "success",
      details: {
        targetUserId: resident.user_id,
        expiresAt,
      },
    })

    return {
      residentId: resident.id,
      targetUserId: resident.user_id,
      residentName: resident.full_name,
      residentPhone: resident.phone,
      temporaryPassword,
      expiresAt,
      loginLink: `${getAppBaseUrl()}/resident/login${resident.phone ? `?phone=${encodeURIComponent(resident.phone)}` : ""}`,
    }
  }

  async getResident(residentId: string, organizationId: string) {
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, organizationId)

    const resident = await this.residentsRepository.getById(residentId, organizationId)
    const isOwnProfile = resident?.user_id === context.authUser.id

    if (anyRoleHasPermission(context.roles, "residents.manage") && resident) {
      this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)
    }

    if (!anyRoleHasPermission(context.roles, "residents.manage") && !isOwnProfile) {
      throw forbidden("Residents can only access their own profile.")
    }

    return assertFound(resident, "Resident not found.")
  }

  async getCurrentResident(organizationId?: string) {
    const context = await this.authService.getCurrentContext()
    const targetOrganizationId = organizationId ?? context.organizationId

    if (!targetOrganizationId) {
      throw forbidden("Your account is not assigned to an organization yet.")
    }

    this.authService.requireOrganizationAccess(context, targetOrganizationId)

    const resident = await this.residentsRepository.getByUserId(
      context.authUser.id,
      targetOrganizationId
    )

    return assertFound(resident, "Resident profile is not linked to this account yet.")
  }

  async createResident(input: unknown): Promise<ResidentCreateResult> {
    const values = createResidentSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)
    if (
      ((values.advancePaymentAmount && values.advancePaymentAmount > 0) ||
        (values.firstMonthFeeAmount && values.firstMonthFeeAmount > 0)) &&
      !anyRoleHasPermission(context.roles, "finance.manage")
    ) {
      throw forbidden("Finance permission is required to record admission payments.")
    }

    const duplicate = await this.residentsRepository.findAdmissionDuplicate({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      phone: values.phone,
      email: values.email,
    })

    if (duplicate) {
      throw duplicateResidentConflict(duplicate)
    }

    const resident = await this.createDraftResident(values, context.authUser.id)
    const currentResident =
      (await this.residentsRepository.getById(resident.id, values.organizationId)) ?? resident
    const invite = await this.createOnboardingInviteForResident({
      organizationId: values.organizationId,
      residentId: currentResident.id,
      deliveryChannel: values.inviteDeliveryChannel,
      expiresInHours: values.inviteExpiresInHours,
    })
    const firstMonthFeePayment = await this.recordAdmissionFirstMonthFeePayment(
      values,
      currentResident,
      context.authUser.id
    )
    const advancePayment = await this.recordAdmissionAdvancePayment(
      values,
      currentResident,
      context.authUser.id
    )

    await this.publishResidentEvent("resident.created", currentResident, context.authUser.id)
    await this.publishAdmissionPaymentEvents(
      [firstMonthFeePayment, advancePayment],
      context.authUser.id
    )

    return {
      resident: currentResident,
      invite,
      advancePayment,
      firstMonthFeePayment,
    }
  }

  private async recordAdmissionFirstMonthFeePayment(
    values: ReturnType<typeof createResidentSchema.parse>,
    resident: { id: string; organization_id: string; hostel_id: string | null },
    actorUserId: string
  ): Promise<PaymentRow | null> {
    if (!values.firstMonthFeeAmount || values.firstMonthFeeAmount <= 0) {
      return null
    }

    if (!resident.hostel_id) {
      throw conflict("Resident hostel is required before recording first month fee.")
    }

    const joinedOn = values.joinedOn ?? new Date().toISOString().slice(0, 10)
    const periodMonth = periodMonthForDate(joinedOn)
    const idempotencyKey = `resident-admission-first-month-${resident.id}-${periodMonth}`
    const existingPayment = await this.paymentsRepository.findByIdempotencyKey(
      values.organizationId,
      idempotencyKey
    )

    if (existingPayment) {
      return this.ensureAdmissionPaymentInvoice(existingPayment, actorUserId)
    }

    const monthlyFee = resolveResidentMonthlyFee(
      values.residentType,
      values.monthlyFeeAmount
    )
    const existingFeeRecord = await this.paymentsRepository.findFeeRecordByResidentPeriod(
      values.organizationId,
      resident.id,
      periodMonth
    )
    const feeRecord =
      existingFeeRecord ??
      (await this.paymentsRepository.createFeeRecord({
        organization_id: values.organizationId,
        hostel_id: resident.hostel_id,
        resident_id: resident.id,
        period_month: periodMonth,
        due_date: joinedOn,
        base_amount: monthlyFee,
        total_amount: monthlyFee,
        balance_amount: monthlyFee,
        status: monthlyFee === 0 ? "paid" : "pending",
        notes: "First month fee generated from quick admission.",
        metadata: {
          source: "resident_quick_admission",
          generated_for_initial_collection: true,
          billing_cycle_start: joinedOn,
        },
        created_by: actorUserId,
        updated_by: actorUserId,
      }))
    const now = new Date().toISOString()
    const paidAmount = Math.min(
      feeRecord.total_amount,
      feeRecord.paid_amount + values.firstMonthFeeAmount
    )
    const balanceAmount = Math.max(0, feeRecord.total_amount - paidAmount)
    const payment = await this.paymentsRepository.create({
      organization_id: values.organizationId,
      hostel_id: resident.hostel_id,
      resident_id: resident.id,
      monthly_fee_record_id: feeRecord.id,
      amount: values.firstMonthFeeAmount,
      method: values.firstMonthFeeMethod,
      status: "verified",
      idempotency_key: idempotencyKey,
      manual_reference: normalizeOptionalText(values.firstMonthFeeManualReference) ?? null,
      notes:
        normalizeOptionalText(values.firstMonthFeeNotes) ??
        "First month fee collected during resident admission.",
      is_advance: false,
      is_partial: balanceAmount > 0,
      provider: "admin_quick_admission",
      paid_at: now,
      verified_at: now,
      verified_by: actorUserId,
      received_by: actorUserId,
      metadata: {
        idempotency_key: idempotencyKey,
        source: "resident_quick_admission",
        first_month_fee: true,
        period_month: periodMonth,
        billing_cycle_start: joinedOn,
      },
      created_by: actorUserId,
      updated_by: actorUserId,
    })

    await this.paymentsRepository.updateFeeRecord(
      feeRecord.id,
      values.organizationId,
      {
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        status: balanceAmount === 0 ? "paid" : paidAmount > 0 ? "partial" : "pending",
        updated_by: actorUserId,
      }
    )

    return this.ensureAdmissionPaymentInvoice(payment, actorUserId)
  }

  private async recordAdmissionAdvancePayment(
    values: ReturnType<typeof createResidentSchema.parse>,
    resident: { id: string; organization_id: string; hostel_id: string | null },
    actorUserId: string
  ): Promise<PaymentRow | null> {
    if (!values.advancePaymentAmount || values.advancePaymentAmount <= 0) {
      return null
    }

    if (!resident.hostel_id) {
      throw conflict("Resident hostel is required before recording admission advance.")
    }

    const idempotencyKey = `resident-admission-advance-${resident.id}`
    const existingPayment = await this.paymentsRepository.findByIdempotencyKey(
      values.organizationId,
      idempotencyKey
    )

    if (existingPayment) {
      return this.ensureAdmissionPaymentInvoice(existingPayment, actorUserId)
    }

    const now = new Date().toISOString()

    const payment = await this.paymentsRepository.create({
      organization_id: values.organizationId,
      hostel_id: resident.hostel_id,
      resident_id: resident.id,
      amount: values.advancePaymentAmount,
      method: values.advancePaymentMethod,
      status: "verified",
      idempotency_key: idempotencyKey,
      manual_reference: normalizeOptionalText(values.advanceManualReference) ?? null,
      notes:
        normalizeOptionalText(values.advanceNotes) ??
        "Advance collected during resident admission.",
      is_advance: true,
      is_partial: false,
      provider: "admin_quick_admission",
      paid_at: now,
      verified_at: now,
      verified_by: actorUserId,
      received_by: actorUserId,
      metadata: {
        idempotency_key: idempotencyKey,
        source: "resident_quick_admission",
        recorded_during_admission: true,
      },
      created_by: actorUserId,
      updated_by: actorUserId,
    })

    return this.ensureAdmissionPaymentInvoice(payment, actorUserId)
  }

  private async ensureAdmissionPaymentInvoice(payment: PaymentRow, actorUserId: string) {
    if (payment.status !== "verified") {
      return payment
    }

    const invoice = payment.monthly_fee_record_id
      ? await this.invoicesService.generateVerifiedMonthlyFeePaymentInvoice({
          payment,
          actorUserId,
        })
      : await this.invoicesService.generatePaymentReceiptInvoice({
          payment,
          actorUserId,
        })

    if (payment.invoice_id === invoice.id) {
      return (
        (await this.paymentsRepository.getById(payment.id, payment.organization_id)) ??
        payment
      )
    }

    return this.paymentsRepository.updateInvoiceLink(
      payment.id,
      payment.organization_id,
      invoice.id,
      actorUserId
    )
  }

  private async createDraftResident(
    values: ReturnType<typeof createResidentSchema.parse>,
    actorUserId: string
  ) {
    try {
      return await this.residentsRepository.create({
        organization_id: values.organizationId,
        hostel_id: values.hostelId,
        admission_number:
          normalizeOptionalText(values.admissionNumber) ?? generateDraftAdmissionNumber(),
        full_name: values.fullName,
        preferred_name: values.preferredName,
        resident_type: values.residentType,
        gender: values.gender,
        date_of_birth: values.dateOfBirth,
        joined_on: values.joinedOn ?? new Date().toISOString().slice(0, 10),
        phone: values.phone,
        email: values.email,
        parent_name: values.parentPhone ? "Father" : undefined,
        parent_phone: values.parentPhone,
        parent_email: null,
        emergency_contact_name: values.emergencyContactPhone ? "Mother" : undefined,
        emergency_contact_phone: values.emergencyContactPhone,
        permanent_address: values.permanentAddress,
        monthly_fee_amount: resolveResidentMonthlyFee(values.residentType, values.monthlyFeeAmount),
        security_deposit_amount: values.securityDepositAmount,
        notes: values.notes,
        status: "draft",
        metadata: {
          admission_flow: "quick_admin_create",
          profile_completion_required: true,
          whatsapp_onboarding_ready: true,
          ...(values.roomId
            ? {
                requested_room_assignment: {
                  room_id: values.roomId,
                  bed_label: normalizeOptionalText(values.bedLabel) ?? null,
                  allocated_from: values.allocatedFrom ?? null,
                },
              }
            : {}),
        },
        created_by: actorUserId,
        updated_by: actorUserId,
      })
    } catch (error) {
      throw mapResidentCreateError(error)
    }
  }

  private async createOnboardingInviteForResident(input: {
    organizationId: string
    residentId: string
    deliveryChannel: ReturnType<typeof createResidentSchema.parse>["inviteDeliveryChannel"]
    expiresInHours: number
  }): Promise<ResidentInviteCreated> {
    try {
      return await this.residentInviteService.createResidentInvite({
        organizationId: input.organizationId,
        residentId: input.residentId,
        deliveryChannel: input.deliveryChannel,
        expiresInHours: input.expiresInHours,
      })
    } catch (error) {
      throw mapResidentInviteCreateError(error)
    }
  }

  async updateResident(input: unknown) {
    const values = updateResidentSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")

    const existingResident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingResident.organization_id,
      existingResident.hostel_id
    )

    const resident = await this.residentsRepository.update(values.residentId, values.organizationId, {
      full_name: values.fullName,
      preferred_name: values.preferredName,
      resident_type: values.residentType,
      gender: values.gender,
      date_of_birth: values.dateOfBirth,
      phone: values.phone,
      email: values.email,
      parent_name: values.parentPhone ? "Father" : undefined,
      parent_phone: values.parentPhone,
      parent_email: null,
      emergency_contact_name: values.emergencyContactPhone ? "Mother" : undefined,
      emergency_contact_phone: values.emergencyContactPhone,
      permanent_address: values.permanentAddress,
      monthly_fee_amount:
        values.residentType === undefined
          ? values.monthlyFeeAmount
          : resolveResidentMonthlyFee(values.residentType, values.monthlyFeeAmount),
      security_deposit_amount: values.securityDepositAmount,
      notes: values.notes,
      status: values.status,
      updated_by: context.authUser.id,
    })

    await this.publishResidentEvent("resident.updated", resident, context.authUser.id)

    return resident
  }

  async updateCurrentResident(input: unknown) {
    const values = updateOwnResidentProfileSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = assertFound(
      await this.residentsRepository.getByUserId(context.authUser.id, values.organizationId),
      "Resident profile is not linked to this account yet."
    )

    const updated = await this.residentsRepository.update(resident.id, values.organizationId, {
      preferred_name: values.preferredName,
      phone: values.phone,
      email: values.email,
      parent_name: values.parentPhone ? "Father" : undefined,
      parent_phone: values.parentPhone,
      parent_email: null,
      emergency_contact_name: values.emergencyContactPhone ? "Mother" : undefined,
      emergency_contact_phone: values.emergencyContactPhone,
      permanent_address: values.permanentAddress,
      updated_by: context.authUser.id,
    })

    const completedProfile = hasCompletedResidentSelfProfile({
      ...resident,
      ...updated,
    })

    if (completedProfile && updated.status === "draft") {
      const activated = await this.residentsRepository.activateCompletedProfile({
        residentId: updated.id,
        organizationId: values.organizationId,
        actorUserId: context.authUser.id,
        metadata: recordFromUnknown(updated.metadata),
        onboardingMetadata: recordFromUnknown(
          (updated as ResidentWithOnboarding).onboarding_metadata
        ),
      })

      await this.publishResidentEvent("resident.updated", activated, context.authUser.id)

      return activated
    }

    await this.publishResidentEvent("resident.updated", updated, context.authUser.id)

    return updated
  }

  async onboardResident(residentId: string, userId: string) {
    const context = await this.authService.requireAdmin()
    const resident = assertFound(
      await this.residentsRepository.getById(residentId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    const { data, error } = await createSupabaseAdminClient().rpc("onboard_resident", {
      target_resident_id: residentId,
      target_user_id: userId,
    })

    if (error) {
      throw forbidden(error.message)
    }

    return data
  }

  async deactivateResident(input: unknown) {
    const values = residentIdMutationSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")

    const existingResident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingResident.organization_id,
      existingResident.hostel_id
    )

    const resident = await this.residentsRepository.deactivate(
      values.residentId,
      values.organizationId,
      context.authUser.id
    )

    await this.publishResidentEvent("resident.deactivated", resident, context.authUser.id)

    return resident
  }

  async checkoutResident(input: unknown) {
    const values = checkoutResidentSchema.parse(input)
    const context = await this.authService.requirePermission("residents.manage")

    const existingResident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingResident.organization_id,
      existingResident.hostel_id
    )

    try {
      const resident = await this.residentsRepository.checkout({
        residentId: values.residentId,
        organizationId: values.organizationId,
        checkoutDate: values.checkoutDate ?? new Date().toISOString().slice(0, 10),
        reason: values.reason ?? "Resident left from admin residents workflow.",
        actorUserId: context.authUser.id,
      })

      await this.publishResidentEvent("resident.checked_out", resident, context.authUser.id)

      return resident
    } catch (error) {
      throw mapResidentAllocationError(error)
    }
  }

  async repairResidentLifecycle(input: unknown) {
    const values = repairResidentLifecycleSchema.parse(input)
    const context = await this.authService.requirePermission("settings.manage")

    const existingResident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(
      context,
      existingResident.organization_id,
      existingResident.hostel_id
    )

    const result = await this.operationsRepository.repairResidentLifecycle({
      organizationId: values.organizationId,
      residentId: values.residentId,
      actorUserId: context.authUser.id,
      dryRun: values.dryRun,
    })

    logger.info({
      event: "resident.lifecycle_repair_requested",
      message: "Admin executed resident lifecycle repair.",
      organizationId: values.organizationId,
      userId: context.authUser.id,
      metadata: {
        residentId: values.residentId,
        dryRun: values.dryRun,
        correlationId: result.correlationId,
        repairs: result.repairs,
      },
    })

    await this.publishResidentEvent(
      "resident.updated",
      existingResident,
      context.authUser.id
    )

    return result
  }

  private async publishAdmissionPaymentEvents(
    payments: Array<PaymentRow | null>,
    actorUserId: string
  ) {
    const recordedPayments = payments.filter(
      (payment): payment is PaymentRow => Boolean(payment)
    )

    if (recordedPayments.length === 0) {
      return
    }

    await Promise.all(
      recordedPayments.flatMap((payment) => [
        this.realtimeService.paymentStatusChanged({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
          actorUserId,
          paymentId: payment.id,
          residentId: payment.resident_id,
          status: payment.status,
        }),
        this.realtimeService.dashboardRefresh({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
          reason: "admission_payment_recorded",
        }),
      ])
    )
  }

  private async publishResidentEvent(
    type: RealtimeEventType,
    resident: { id: string; organization_id: string; hostel_id: string | null },
    actorUserId: string,
    metadata?: { allocatedRoomId?: string | null }
  ) {
    try {
      const publisher = new RealtimeEventPublisher()
      const payload = {
        residentId: resident.id,
        hostelId: resident.hostel_id,
        allocatedRoomId: metadata?.allocatedRoomId ?? null,
      }

      await Promise.all([
        publisher.publish({
          type,
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
          actorUserId,
          payload,
        }),
        publisher.publish({
          type: "vacancy.changed",
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
          actorUserId,
          payload: {
            reason: type,
            residentId: resident.id,
            allocatedRoomId: metadata?.allocatedRoomId ?? null,
          },
        }),
        publisher.publish({
          type: "dashboard.refresh",
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
          actorUserId,
          payload: {
            reason: type,
            residentId: resident.id,
          },
        }),
      ])
    } catch (error) {
      logger.warn({
        event: "resident.realtime_publish_failed",
        message: "Resident lifecycle completed, but realtime refresh could not be published.",
        organizationId: resident.organization_id,
        userId: actorUserId,
        error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
        metadata: { residentId: resident.id, eventType: type },
      })
    }
  }
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim()

  return normalized || undefined
}

function generateDraftAdmissionNumber() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const suffix = randomUUID().slice(0, 8).toUpperCase()

  return `DRAFT-${timestamp}-${suffix}`
}

function generateTemporaryPassword() {
  return `Sbh-${randomBytes(9).toString("base64url")}!7`
}

function getAppBaseUrl() {
  return getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
}

function periodMonthForDate(date: string) {
  return `${date.slice(0, 7)}-01`
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function hasCompletedResidentSelfProfile(resident: {
  phone?: string | null
  parent_phone?: string | null
  emergency_contact_phone?: string | null
  permanent_address?: string | null
}) {
  return [
    resident.phone,
    resident.parent_phone,
    resident.emergency_contact_phone,
    resident.permanent_address,
  ].every((value) => typeof value === "string" && value.trim().length > 0)
}

function resolveResidentMonthlyFee(residentType: string | undefined, monthlyFeeAmount: number | undefined) {
  if (!residentType || residentType === "student") {
    return HOSTEL_FEES.student
  }

  return monthlyFeeAmount ?? HOSTEL_FEES.student
}

function duplicateResidentConflict(
  duplicate: NonNullable<
    Awaited<ReturnType<ResidentsRepository["findAdmissionDuplicate"]>>
  >
): never {
  const resident = duplicate.resident

  throw conflict(
    "Resident already exists. Continue their onboarding or resend activation instead of creating a duplicate.",
    {
      type: "resident_duplicate",
      matchedFields: duplicate.matchedFields,
      resident: {
        id: resident.id,
        fullName: resident.full_name,
        admissionNumber: resident.admission_number,
        phone: resident.phone,
        email: resident.email,
        status: resident.status,
        hasPortalAccount: Boolean(resident.user_id),
      },
      actions: [
        "open_resident",
        "continue_onboarding",
        "resend_activation",
        "merge_draft",
      ],
    }
  )
}

function mapResidentCreateError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (
    message.includes("residents_admission_uidx") ||
    message.includes("duplicate key value violates unique constraint")
  ) {
    throw conflict(
      "A resident with this admission number or verified contact already exists. Open the existing resident to continue onboarding.",
      {
        type: "resident_duplicate_constraint",
        actions: ["open_resident", "continue_onboarding", "resend_activation"],
      }
    )
  }

  throw error
}

function mapResidentInviteCreateError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (message.includes("already has an activated portal account")) {
    throw conflict(
      "Resident already has portal access. Open the resident profile to resend access or repair auth linkage."
    )
  }

  if (message.includes("email or phone") || message.includes("phone before invite")) {
    throw conflict(
      "Resident was created, but onboarding access could not be generated because phone or email is missing. Add a phone number and resend activation."
    )
  }

  throw error
}

function mapResidentAllocationError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""

  if (message.includes("room_capacity_exceeded")) {
    throw conflict("Room is already full. Choose another room or run occupancy recalculation.")
  }

  if (message.includes("resident_already_allocated")) {
    throw conflict("Resident already has an active room allocation.")
  }

  if (message.includes("room_not_allocatable")) {
    throw conflict("Room is not available for allocation.")
  }

  if (message.includes("resident_not_allocatable")) {
    throw conflict("Resident is not eligible for room allocation.")
  }

  if (message.includes("resident_not_found")) {
    throw conflict("Resident not found.")
  }

  if (message.includes("room_not_found")) {
    throw conflict("Room not found.")
  }

  throw error
}
