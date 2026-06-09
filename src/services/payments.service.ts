import "server-only"

import { anyRoleHasPermission } from "@/constants/auth"
import { areOperationalRepairsEnabled } from "@/config/launch"
import { badRequest, conflict, forbidden } from "@/lib/api/api-error"
import { logError, logPaymentEvent } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import {
  assertNonProductionOperation,
} from "@/lib/operations/production-safety"
import {
  buildResidentBillingContext,
  resolveNextBillingDueDate,
  todayDateOnly,
} from "@/lib/finance/billing-date"
import { createManualPaymentReceiptMarker } from "@/lib/payments/manual-receipt-marker"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestId } from "@/lib/tracing"
import { PaymentSettingsRepository } from "@/repositories/payment-settings.repository"
import { PaymentsRepository, type PaymentRow } from "@/repositories/payments.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import type {
  PaymentSettingRow,
  PaymentSettingView,
} from "@/types/payment-operations"
import type { Json, Tables } from "@/types/database"
import {
  createPaymentSchema,
  generateMonthlyFeeSchema,
  paymentQrUploadSchema,
  paymentListSchema,
  paymentSettingsHistorySchema,
  paymentSettingsQuerySchema,
  paymentSettingsSchema,
  paymentSettingsTestSchema,
  reconcilePaymentInvoicesSchema,
  recordInPersonPaymentSchema,
  rejectPaymentSchema,
  residentPaymentLedgerSchema,
  submitUpiPaymentSchema,
  verifyPaymentSchema,
} from "@/validations/payment.validation"

import { assertFound, AuthService } from "./auth.service"
import { InvoicesService } from "./invoices"
import { NotificationService } from "./notifications"
import { RealtimeService } from "./realtime"
import { UploadsService } from "./uploads.service"

type PaymentSettingsAuditContext = {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

export class PaymentsService {
  private readonly authService: AuthService
  private readonly paymentSettingsRepository: PaymentSettingsRepository
  private readonly paymentsRepository: PaymentsRepository
  private readonly residentsRepository: ResidentsRepository
  private readonly uploadsRepository: UploadsRepository
  private readonly uploadsService: UploadsService
  private readonly invoicesService: InvoicesService
  private readonly notificationService: NotificationService
  private readonly realtimeService: RealtimeService
  private systemPaymentsRepository?: PaymentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.paymentSettingsRepository = new PaymentSettingsRepository(db)
    this.paymentsRepository = new PaymentsRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.uploadsRepository = new UploadsRepository(db)
    this.uploadsService = new UploadsService(db)
    this.invoicesService = new InvoicesService(db)
    this.notificationService = new NotificationService(db)
    this.realtimeService = new RealtimeService(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new PaymentsService(db)
  }

  private getSystemPaymentsRepository() {
    this.systemPaymentsRepository ??= new PaymentsRepository(createSupabaseAdminClient())

    return this.systemPaymentsRepository
  }

  async listPayments(input: unknown) {
    const values = paymentListSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    if (anyRoleHasPermission(context.roles, "finance.manage")) {
      const hostelId = this.authService.resolveHostelScope(
        context,
        values.organizationId,
        values.hostelId
      )

      return this.paymentsRepository.list({
        ...values,
        ...(hostelId ? { hostelId } : {}),
      })
    }

    {
      const resident = await this.residentsRepository.getByUserId(
        context.authUser.id,
        values.organizationId
      )

      if (!resident || (values.residentId && values.residentId !== resident.id)) {
        throw forbidden("Residents can only view their own payments.")
      }

      return this.paymentsRepository.list({
        ...values,
        residentId: resident.id,
      })
    }
  }

  async recordManualPayment(input: unknown) {
    const values = createPaymentSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const resident = await this.residentsRepository.getById(
      values.residentId,
      values.organizationId
    )

    const existingResident = assertFound(resident, "Resident not found.")

    if (existingResident.hostel_id !== values.hostelId) {
      throw conflict("Payment hostel does not match resident hostel.")
    }

    if (values.idempotencyKey) {
      const existingPayment = await this.paymentsRepository.findByIdempotencyKey(
        values.organizationId,
        values.idempotencyKey
      )

      if (existingPayment) {
        return existingPayment
      }
    }

    const payment = await this.paymentsRepository.create({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      resident_id: values.residentId,
      monthly_fee_record_id: values.monthlyFeeRecordId,
      invoice_id: values.invoiceId,
      amount: values.amount,
      method: values.method,
      status: "pending",
      transaction_id: values.transactionId,
      idempotency_key: values.idempotencyKey,
      manual_reference: values.manualReference,
      notes: values.notes,
      is_advance: values.isAdvance,
      is_partial: values.isPartial,
      metadata: values.idempotencyKey
        ? {
            idempotency_key: values.idempotencyKey,
          }
        : {},
      received_by: context.authUser.id,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    logPaymentEvent({
      action: "created",
      paymentId: payment.id,
      residentId: payment.resident_id,
      organizationId: payment.organization_id,
      actorUserId: context.authUser.id,
      amount: payment.amount,
      status: payment.status,
      details: {
        method: payment.method,
        manual: true,
      },
    })
    incrementMetric("payments.created", 1, {
      organizationId: payment.organization_id,
      method: payment.method,
      status: payment.status,
    })

    return payment
  }

  async recordInPersonPayment(input: unknown) {
    const values = recordInPersonPaymentSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const idempotencyKey = values.idempotencyKey ?? crypto.randomUUID()

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    if (resident.hostel_id !== values.hostelId) {
      throw conflict("Payment hostel does not match resident hostel.")
    }

    let payment = await this.paymentsRepository.findByIdempotencyKey(
      values.organizationId,
      idempotencyKey
    )

    if (payment) {
      if (
        payment.resident_id !== values.residentId ||
        payment.hostel_id !== values.hostelId ||
        payment.organization_id !== values.organizationId
      ) {
        throw conflict("This in-person payment reference is already used for another resident.")
      }

      if (payment.status === "verified") {
        return payment
      }

      if (payment.status !== "pending") {
        throw conflict("This in-person payment is not ready for admin verification.")
      }
    } else {
      await this.assertManualPaymentPolicy({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        amount: values.amount,
        isPartial: values.isPartial,
        isAdvance: values.isAdvance,
      })
      await this.assertResidentPaymentAmount({
        organizationId: values.organizationId,
        hostelId: values.hostelId,
        residentId: values.residentId,
        monthlyFeeRecordId: values.monthlyFeeRecordId,
        amount: values.amount,
        isPartial: values.isPartial,
        isAdvance: values.isAdvance,
      })

      payment = await this.paymentsRepository.create({
        organization_id: values.organizationId,
        hostel_id: values.hostelId,
        resident_id: values.residentId,
        monthly_fee_record_id: values.isAdvance ? null : values.monthlyFeeRecordId,
        amount: values.amount,
        method: values.method,
        status: "pending",
        transaction_id:
          (values.method === "bank_transfer" || values.method === "upi") &&
          values.manualReference
            ? values.manualReference
            : null,
        idempotency_key: idempotencyKey,
        manual_reference: values.manualReference || null,
        notes: values.notes || null,
        is_advance: values.isAdvance,
        is_partial: values.isPartial,
        provider: "admin_manual_entry",
        paid_at: new Date().toISOString(),
        metadata: {
          idempotency_key: idempotencyKey,
          source: "admin_in_person",
          collection_workflow: "finance_collection_center",
          collection_method: values.method,
          manual_entry: true,
          created_as_pending_for_atomic_verification: true,
        },
        received_by: context.authUser.id,
        created_by: context.authUser.id,
        updated_by: context.authUser.id,
      })
    }

    const manualProof = await this.ensureManualPaymentProof(payment, context.authUser.id, {
      manualReference: values.manualReference || null,
      notes: values.notes || null,
    })

    let verifiedPayment = await this.paymentsRepository.verify(
      payment.id,
      values.organizationId,
      context.authUser.id,
      idempotencyKey
    )

    await this.markManualPaymentProofVerified(
      manualProof.id,
      values.organizationId,
      context.authUser.id
    )

    verifiedPayment = await this.finalizeVerifiedPaymentInvoice(
      verifiedPayment,
      context.authUser.id,
      "payment.invoice_generation_after_manual_entry_failed"
    )

    logPaymentEvent({
      action: "verified",
      paymentId: verifiedPayment.id,
      residentId: verifiedPayment.resident_id,
      organizationId: verifiedPayment.organization_id,
      actorUserId: context.authUser.id,
      amount: verifiedPayment.amount,
      status: verifiedPayment.status,
      details: {
        method: verifiedPayment.method,
        manualReference: verifiedPayment.manual_reference,
      },
    })
    incrementMetric("payments.in_person_recorded", 1, {
      organizationId: verifiedPayment.organization_id,
      method: verifiedPayment.method,
      status: verifiedPayment.status,
    })

    await this.publishPaymentVerificationEvents(verifiedPayment, context.authUser.id)

    return verifiedPayment
  }

  async submitUpiPaymentWithProof(input: unknown, proofFile: File) {
    const values = submitUpiPaymentSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )
    const isFinanceUser = anyRoleHasPermission(context.roles, "finance.manage")

    if (!isFinanceUser && resident.user_id !== context.authUser.id) {
      throw forbidden("Residents can only submit payments for their own profile.")
    }

    if (resident.hostel_id !== values.hostelId) {
      throw conflict("Payment hostel does not match resident hostel.")
    }

    if (isFinanceUser) {
      this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)
    }

    await this.assertPaymentSettingPolicy({
      ...values,
      requireTransactionReference: false,
    })
    await this.assertResidentPaymentAmount({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      monthlyFeeRecordId: values.isAdvance ? undefined : values.monthlyFeeRecordId,
      amount: values.amount,
      isPartial: values.isPartial,
      isAdvance: values.isAdvance,
    })

    const transactionId =
      values.transactionId ?? createScreenshotPaymentReference(values.idempotencyKey)

    let payment = await this.paymentsRepository.createResidentUpiDraft({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      monthlyFeeRecordId: values.isAdvance ? undefined : values.monthlyFeeRecordId,
      amount: values.amount,
      transactionId,
      idempotencyKey: values.idempotencyKey,
      notes: values.notes,
      isAdvance: values.isAdvance,
      isPartial: values.isPartial,
      actorUserId: context.authUser.id,
    })

    const existingProof = await this.uploadsRepository.findLatestPaymentProof(
      values.organizationId,
      payment.id
    )

    if (!existingProof) {
      const uploaded = await this.uploadsService.uploadPaymentProof(
        {
          organizationId: values.organizationId,
          hostelId: values.hostelId,
          residentId: values.residentId,
          paymentId: payment.id,
        },
        proofFile
      )

      payment = await this.paymentsRepository.finalizeSubmission(
        payment.id,
        values.organizationId,
        uploaded.document.id,
        context.authUser.id
      )
    } else if (payment.status === "initiated") {
      payment = await this.paymentsRepository.finalizeSubmission(
        payment.id,
        values.organizationId,
        existingProof.id,
        context.authUser.id
      )
    }

    logPaymentEvent({
      action: "submitted_with_proof",
      paymentId: payment.id,
      residentId: payment.resident_id,
      organizationId: payment.organization_id,
      actorUserId: context.authUser.id,
      amount: payment.amount,
      status: payment.status,
      details: {
        idempotencyKey: values.idempotencyKey,
        method: payment.method,
        referenceProvidedByResident: Boolean(values.transactionId),
      },
    })
    incrementMetric("payments.submitted_with_proof", 1, {
      organizationId: payment.organization_id,
      method: payment.method,
      status: payment.status,
    })

    await this.realtimeService.paymentStatusChanged({
      organizationId: payment.organization_id,
      hostelId: payment.hostel_id,
      actorUserId: context.authUser.id,
      paymentId: payment.id,
      residentId: payment.resident_id,
      status: payment.status,
    })

    return payment
  }

  async createUpiPayment(input: unknown) {
    const values = createPaymentSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = await this.residentsRepository.getById(
      values.residentId,
      values.organizationId
    )
    const existingResident = assertFound(resident, "Resident not found.")
    const isFinanceUser = anyRoleHasPermission(context.roles, "finance.manage")

    if (!isFinanceUser && existingResident.user_id !== context.authUser.id) {
      throw forbidden("Residents can only create their own payment records.")
    }

    if (existingResident.hostel_id !== values.hostelId) {
      throw conflict("Payment hostel does not match resident hostel.")
    }

    if (isFinanceUser) {
      this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)
    }

    await this.assertPaymentSettingPolicy(values)
    await this.assertResidentPaymentAmount({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      monthlyFeeRecordId: values.monthlyFeeRecordId,
      amount: values.amount,
      isPartial: values.isPartial,
      isAdvance: values.isAdvance,
    })

    if (values.idempotencyKey) {
      const existingPayment = await this.paymentsRepository.findByIdempotencyKey(
        values.organizationId,
        values.idempotencyKey
      )

      if (existingPayment) {
        return existingPayment
      }
    }

    if (!values.transactionId) {
      throw conflict("UPI transaction reference is required.")
    }

    const payment = await this.paymentsRepository.createResidentUpiDraft({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      monthlyFeeRecordId: values.monthlyFeeRecordId,
      amount: values.amount,
      transactionId: values.transactionId,
      idempotencyKey: values.idempotencyKey ?? crypto.randomUUID(),
      notes: values.notes,
      isAdvance: values.isAdvance,
      isPartial: values.isPartial,
      actorUserId: context.authUser.id,
    })

    logPaymentEvent({
      action: "created",
      paymentId: payment.id,
      residentId: payment.resident_id,
      organizationId: payment.organization_id,
      actorUserId: context.authUser.id,
      amount: payment.amount,
      status: payment.status,
      details: {
        method: payment.method,
        provider: payment.provider,
      },
    })
    incrementMetric("payments.created", 1, {
      organizationId: payment.organization_id,
      method: payment.method,
      status: payment.status,
    })

    return payment
  }

  async getPayment(paymentId: string, organizationId: string) {
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, organizationId)

    const payment = await this.paymentsRepository.getById(paymentId, organizationId)
    const existingPayment = assertFound(payment, "Payment not found.")

    if (anyRoleHasPermission(context.roles, "finance.manage")) {
      this.authService.requireHostelAccess(
        context,
        existingPayment.organization_id,
        existingPayment.hostel_id
      )
    }

    if (!anyRoleHasPermission(context.roles, "finance.manage")) {
      const resident = await this.residentsRepository.getByUserId(
        context.authUser.id,
        organizationId
      )

      if (!resident || resident.id !== existingPayment.resident_id) {
        throw forbidden("Residents can only view their own payments.")
      }
    }

    return existingPayment
  }

  async listResidentPayments(organizationId: string, residentId: string) {
    return this.listPayments({
      organizationId,
      residentId,
      page: 1,
      pageSize: 50,
    })
  }

  async getActivePaymentSettings(input: unknown) {
    const values = paymentSettingsQuerySchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    if (anyRoleHasPermission(context.roles, "finance.manage")) {
      this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)
    } else {
      const resident = await this.residentsRepository.getByUserId(
        context.authUser.id,
        values.organizationId
      )

      if (!resident || resident.hostel_id !== values.hostelId) {
        throw forbidden("Residents can only view payment settings for their own hostel.")
      }
    }

    const setting = await this.paymentSettingsRepository.getActive(
      values.organizationId,
      values.hostelId
    )

    return setting ? this.withQrSignedUrl(setting) : null
  }

  async listPaymentSettings(input: unknown) {
    const values = paymentSettingsHistorySchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const settings = await this.paymentSettingsRepository.list(
      values.organizationId,
      values.hostelId
    )

    return Promise.all(settings.map((setting) => this.withQrSignedUrl(setting)))
  }

  async savePaymentSettings(input: unknown, auditContext?: PaymentSettingsAuditContext) {
    const values = paymentSettingsSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const previousSetting = values.id
      ? await this.paymentSettingsRepository.getById(values.organizationId, values.id)
      : await this.paymentSettingsRepository.getActive(values.organizationId, values.hostelId)
    const rotate = Boolean(values.rotate && previousSetting)
    const qrReplaced = Boolean(
      values.qrReplaced ||
        (previousSetting?.qr_image_path &&
          values.qrImagePath &&
          previousSetting.qr_image_path !== values.qrImagePath)
    )

    const setting = await this.paymentSettingsRepository.upsert({
      id: rotate ? undefined : values.id,
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      paymentMethod: values.paymentMethod,
      accountName: values.accountName,
      upiId: values.upiId || undefined,
      qrImagePath: values.qrImagePath || undefined,
      bankName: values.bankName || undefined,
      branchName: values.branchName || undefined,
      accountLast4: values.accountLast4 || undefined,
      isActive: values.isActive,
      supportsManualVerification: values.supportsManualVerification,
      instructions: values.instructions || undefined,
      requireUtr: values.requireUtr,
      requireScreenshot: values.requireScreenshot,
      allowPartialPayment: values.allowPartialPayment,
      allowAdvancePayment: values.allowAdvancePayment,
      autoExpirePendingPayments: values.autoExpirePendingPayments,
      minPaymentAmount: values.minPaymentAmount,
      utrRegex: values.utrRegex,
      duplicateDetectionStrictness: values.duplicateDetectionStrictness,
      rotate,
      rotatedFromSettingId: rotate ? previousSetting?.id : values.rotate ? values.id : undefined,
      qrReplaced,
      actorUserId: context.authUser.id,
    })

    try {
      await this.paymentSettingsRepository.createAuditLog({
        organization_id: setting.organization_id,
        hostel_id: setting.hostel_id,
        actor_user_id: context.authUser.id,
        table_name: "payment_settings",
        record_id: setting.id,
        action: rotate
          ? "payment_settings.rotated"
          : previousSetting
            ? "payment_settings.updated"
            : "payment_settings.created",
        old_values: previousSetting ?? null,
        new_values: setting,
        ip_address: auditContext?.ipAddress ?? null,
        user_agent: auditContext?.userAgent ?? null,
        request_id: auditContext?.requestId ?? getRequestId(),
        metadata: {
          rotate,
          qrReplaced,
          previousSettingId: previousSetting?.id ?? null,
          version: setting.version,
          qrVersion: setting.qr_version,
        },
        created_by: context.authUser.id,
        updated_by: context.authUser.id,
      })
    } catch (error) {
      logError(error, {
        event: "payment_settings.audit_log_failed",
        organizationId: setting.organization_id,
        hostelId: setting.hostel_id,
      })
    }

    logPaymentEvent({
      action: "payment_settings_saved",
      organizationId: setting.organization_id,
      actorUserId: context.authUser.id,
      status: setting.is_active ? "active" : "inactive",
      details: {
        hostelId: setting.hostel_id,
        paymentMethod: setting.payment_method,
      },
    })

    await this.realtimeService.paymentSettingsChanged({
      organizationId: setting.organization_id,
      hostelId: setting.hostel_id,
      actorUserId: context.authUser.id,
      paymentSettingId: setting.id,
      version: setting.version,
      qrVersion: setting.qr_version,
      isActive: setting.is_active,
    })

    return this.withQrSignedUrl(setting)
  }

  async testPaymentSettings(input: unknown) {
    const values = paymentSettingsTestSchema.parse(input)

    assertNonProductionOperation("test_payment_generation")

    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const checks: Array<{
      key: string
      label: string
      status: "pass" | "warning" | "fail"
      message: string
    }> = []

    checks.push({
      key: "upi_format",
      label: "UPI format",
      status: values.paymentMethod === "upi" && values.upiId ? "pass" : "warning",
      message: values.upiId
        ? "UPI ID passes frontend and API validation."
        : "No UPI ID is configured. Residents will depend on QR-only payment instructions.",
    })
    checks.push({
      key: "qr_image",
      label: "QR image",
      status: values.qrImagePath ? "pass" : "warning",
      message: values.qrImagePath
        ? "QR image path is configured and will be signed server-side."
        : "No QR image is configured. Residents will need to copy the UPI ID manually.",
    })
    checks.push({
      key: "utr_policy",
      label: "UTR policy",
      status: values.requireUtr ? "pass" : "fail",
      message: values.requireUtr
        ? "UTR/reference is required for duplicate prevention."
        : "Disabling UTR weakens manual payment reconciliation and is not recommended.",
    })
    checks.push({
      key: "screenshot_policy",
      label: "Screenshot policy",
      status: values.requireScreenshot ? "pass" : "warning",
      message: values.requireScreenshot
        ? "Screenshot upload is required before finance verification."
        : "Screenshot requirement is disabled in configuration; verification still requires strong audit evidence.",
    })
    checks.push({
      key: "amount_policy",
      label: "Minimum amount",
      status: values.minPaymentAmount > 0 ? "pass" : "fail",
      message: `Minimum accepted amount is ${values.minPaymentAmount}.`,
    })

    return {
      status: checks.some((check) => check.status === "fail")
        ? "fail"
        : checks.some((check) => check.status === "warning")
          ? "warning"
          : "pass",
      checks,
    }
  }

  async uploadPaymentQr(input: unknown, file: File, auditContext?: PaymentSettingsAuditContext) {
    const values = paymentQrUploadSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)
    this.validateQrFile(file)

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const storagePath = `${values.organizationId}/payment-settings/qr/${values.hostelId}/current.${extension}`

    await this.uploadsRepository.uploadObject("payment-qr-codes", storagePath, file, {
      upsert: true,
      cacheControl: "60",
    })

    const expiresInSeconds = 900
    const signedUrlExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    const signedUrl = await this.uploadsRepository.createSignedUrl(
      "payment-qr-codes",
      storagePath,
      expiresInSeconds
    )

    await this.recordPaymentSettingsAuditLog({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      actorUserId: context.authUser.id,
      tableName: "storage.objects",
      recordId: null,
      action: "payment_settings.qr_uploaded",
      oldValues: null,
      newValues: {
        bucketName: "payment-qr-codes",
        storagePath,
        contentType: file.type,
        size: file.size,
        signedUrlExpiresAt,
      },
      metadata: {
        bucketName: "payment-qr-codes",
        storagePath,
      },
      auditContext,
    })

    logPaymentEvent({
      action: "payment_qr_uploaded",
      organizationId: values.organizationId,
      actorUserId: context.authUser.id,
      details: {
        hostelId: values.hostelId,
        storagePath,
      },
    })

    return {
      bucketName: "payment-qr-codes" as const,
      storagePath,
      signedUrl: appendQrPreviewCacheBust(signedUrl, {
        storagePath,
        qrVersion: 0,
        updatedAt: signedUrlExpiresAt,
      }),
      expiresInSeconds,
      signedUrlExpiresAt,
    }
  }

  async getResidentLedger(input: unknown) {
    const values = residentPaymentLedgerSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    let residentId = values.residentId

    if (!anyRoleHasPermission(context.roles, "finance.manage")) {
      const resident = await this.residentsRepository.getByUserId(
        context.authUser.id,
        values.organizationId
      )

      if (!resident) {
        throw forbidden("Resident profile is required to view the payment ledger.")
      }

      if (residentId && residentId !== resident.id) {
        throw forbidden("Residents can only view their own payment ledger.")
      }

      residentId = resident.id
    }

    if (!residentId) {
      throw badRequest("residentId is required for finance ledger lookup.")
    }

    const resident = assertFound(
      await this.residentsRepository.getById(residentId, values.organizationId),
      "Resident not found."
    )

    if (anyRoleHasPermission(context.roles, "finance.manage")) {
      this.authService.requireHostelAccess(context, values.organizationId, resident.hostel_id)
    }

    const billing = buildResidentBillingContext({ joinedOn: resident.joined_on })
    const feeRecords = await this.paymentsRepository.listFeeRecords({
      organizationId: values.organizationId,
      hostelId: resident.hostel_id,
      residentId: resident.id,
      page: 1,
      pageSize: 100,
    })
    const payments = await this.paymentsRepository.listResidentPayments(
      values.organizationId,
      resident.id,
      { page: 1, pageSize: 100 }
    )
    const invoices = await this.paymentsRepository.listResidentInvoices(
      values.organizationId,
      resident.id,
      50
    )

    const unpaidFeeRecords = feeRecords.data
      .filter((record) => ["pending", "partial", "overdue"].includes(record.status))
      .toSorted(compareFeeRecordsByDueDate)
    const currentDue = unpaidFeeRecords.reduce(
      (total, record) => total + record.balance_amount,
      0
    )
    const today = todayDateOnly()
    const overdue = unpaidFeeRecords
      .filter((record) => record.balance_amount > 0 && isDateBefore(record.due_date, today))
      .reduce((total, record) => total + record.balance_amount, 0)
    const pendingVerification = payments.data
      .filter((payment) => payment.status === "pending" || payment.status === "initiated")
      .reduce((total, payment) => total + payment.amount, 0)
    const verifiedPaid = payments.data
      .filter((payment) => payment.status === "verified")
      .reduce((total, payment) => total + payment.amount, 0)
    const advanceBalance = payments.data
      .filter((payment) => payment.status === "verified" && payment.is_advance)
      .reduce((total, payment) => total + payment.amount, 0)

    return {
      resident: {
        id: resident.id,
        full_name: resident.full_name,
        hostel_id: resident.hostel_id,
        monthly_fee_amount: resident.monthly_fee_amount,
        joined_on: resident.joined_on,
      },
      totals: {
        currentDue,
        overdue,
        pendingVerification,
        verifiedPaid,
        advanceBalance,
      },
      billing: {
        joinedOn: resident.joined_on,
        currentPeriodMonth: billing.currentPeriodMonth,
        currentDueDate: billing.currentDueDate,
        nextDueDate: resolveNextBillingDueDate({ billing }),
        generatedCurrentDue: false,
      },
      primaryDueRecord: unpaidFeeRecords[0] ?? null,
      feeRecords: feeRecords.data,
      payments: payments.data,
      invoices,
    }
  }

  async verifyPayment(input: unknown) {
    const values = verifyPaymentSchema.parse(input)
    const context = await this.authService.requirePermission("payments.verify")

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const payment = await this.paymentsRepository.getById(
      values.paymentId,
      values.organizationId
    )

    const existingPayment = assertFound(payment, "Payment not found.")

    this.authService.requireHostelAccess(
      context,
      existingPayment.organization_id,
      existingPayment.hostel_id
    )

    logPaymentEvent({
      action: "verification_attempted",
      paymentId: existingPayment.id,
      residentId: existingPayment.resident_id,
      organizationId: existingPayment.organization_id,
      actorUserId: context.authUser.id,
      amount: existingPayment.amount,
      status: existingPayment.status,
    })

    if (existingPayment.status === "verified") {
      const reconciledPayment = await this.finalizeVerifiedPaymentInvoice(
        existingPayment,
        context.authUser.id,
        "payment.invoice_generation_for_verified_payment_failed"
      )

      logPaymentEvent({
        action: "verified_payment_reconciled",
        paymentId: reconciledPayment.id,
        residentId: reconciledPayment.resident_id,
        organizationId: reconciledPayment.organization_id,
        actorUserId: context.authUser.id,
        amount: reconciledPayment.amount,
        status: reconciledPayment.status,
      })

      return reconciledPayment
    }

    if (existingPayment.status === "initiated") {
      throw conflict("Payment proof submission is not finalized yet.")
    }

    const proof = await this.uploadsRepository.findLatestPaymentProof(
      values.organizationId,
      values.paymentId
    )

    if (!proof) {
      throw conflict("Payment proof is required before verification.")
    }

    if (proof.resident_id !== existingPayment.resident_id) {
      throw conflict("Payment proof ownership does not match this payment.")
    }

    let verifiedPayment = await this.paymentsRepository.verify(
      values.paymentId,
      values.organizationId,
      context.authUser.id,
      values.idempotencyKey
    )

    verifiedPayment = await this.finalizeVerifiedPaymentInvoice(
      verifiedPayment,
      context.authUser.id,
      "payment.invoice_generation_after_verification_failed"
    )

    logPaymentEvent({
      action: "verified",
      paymentId: verifiedPayment.id,
      residentId: verifiedPayment.resident_id,
      organizationId: verifiedPayment.organization_id,
      actorUserId: context.authUser.id,
      amount: verifiedPayment.amount,
      status: verifiedPayment.status,
    })
    incrementMetric("payments.verified", 1, {
      organizationId: verifiedPayment.organization_id,
      method: verifiedPayment.method,
    })

    await this.publishPaymentVerificationEvents(verifiedPayment, context.authUser.id)

    return verifiedPayment
  }

  async rejectPayment(input: unknown) {
    const values = rejectPaymentSchema.parse(input)
    const context = await this.authService.requirePermission("payments.verify")

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const payment = await this.paymentsRepository.getById(
      values.paymentId,
      values.organizationId
    )
    const existingPayment = assertFound(payment, "Payment not found.")

    this.authService.requireHostelAccess(
      context,
      existingPayment.organization_id,
      existingPayment.hostel_id
    )

    if (existingPayment.status === "verified") {
      throw conflict("Verified payments cannot be rejected.")
    }

    const rejectedPayment = await this.paymentsRepository.reject(
      values.paymentId,
      values.organizationId,
      context.authUser.id,
      values.reason
    )

    logPaymentEvent({
      action: "rejected",
      paymentId: rejectedPayment.id,
      residentId: rejectedPayment.resident_id,
      organizationId: rejectedPayment.organization_id,
      actorUserId: context.authUser.id,
      amount: rejectedPayment.amount,
      status: rejectedPayment.status,
      details: {
        reason: values.reason,
      },
    })
    incrementMetric("payments.rejected", 1, {
      organizationId: rejectedPayment.organization_id,
      method: rejectedPayment.method,
    })

    await this.realtimeService.paymentStatusChanged({
      organizationId: rejectedPayment.organization_id,
      hostelId: rejectedPayment.hostel_id,
      actorUserId: context.authUser.id,
      paymentId: rejectedPayment.id,
      residentId: rejectedPayment.resident_id,
      status: rejectedPayment.status,
    })

    return rejectedPayment
  }

  async generateMonthlyFee(input: unknown) {
    const values = generateMonthlyFeeSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    if (resident.hostel_id !== values.hostelId) {
      throw conflict("Monthly due hostel does not match resident hostel.")
    }

    const existing = await this.paymentsRepository.findFeeRecordByResidentPeriod(
      values.organizationId,
      values.residentId,
      values.periodMonth
    )

    if (existing) {
      return existing
    }

    const baseAmount = resident.monthly_fee_amount
    const totalAmount =
      baseAmount +
      values.penaltyAmount +
      values.adjustmentAmount -
      values.discountAmount -
      values.advanceAdjustmentAmount

    if (totalAmount < 0) {
      throw conflict("Calculated fee total cannot be negative.")
    }

    const feeRecord = await this.paymentsRepository.createFeeRecord({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      resident_id: values.residentId,
      room_allocation_id: null,
      period_month: values.periodMonth,
      due_date: values.dueDate,
      base_amount: baseAmount,
      discount_amount: values.discountAmount,
      penalty_amount: values.penaltyAmount,
      adjustment_amount: values.adjustmentAmount,
      advance_adjustment_amount: values.advanceAdjustmentAmount,
      total_amount: totalAmount,
      balance_amount: totalAmount,
      status: totalAmount === 0 ? "paid" : "pending",
      notes: values.notes,
      metadata: {
        source: "manual_monthly_fee_generation",
        derived_from_resident_monthly_fee_amount: true,
        resident_monthly_fee_amount: baseAmount,
        adjustment_reason: values.adjustmentReason ?? null,
        generated_by_user_id: context.authUser.id,
      },
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    if (isSupabaseQueryClient(this.db)) {
      try {
        const { AdvanceLedgerService } = await import("@/services/advance-ledger")
        await new AdvanceLedgerService(this.db).allocateForResidentSystem({
          organizationId: values.organizationId,
          hostelId: values.hostelId,
          residentId: values.residentId,
          actorUserId: context.authUser.id,
          limit: 1,
        })
      } catch (error) {
        logError(error, {
          event: "advance_ledger.auto_allocation_after_fee_generation_failed",
          organizationId: values.organizationId,
          hostelId: values.hostelId,
          residentId: values.residentId,
          monthlyFeeRecordId: feeRecord.id,
        })
      }
    }

    return feeRecord
  }

  async reconcilePaymentInvoices(input: unknown) {
    const values = reconcilePaymentInvoicesSchema.parse(input)

    if (!areOperationalRepairsEnabled()) {
      throw forbidden(
        "Payment invoice reconciliation is disabled by OPERATIONAL_REPAIRS_ENABLED=false."
      )
    }

    const context = await this.authService.requirePermission("finance.manage")
    const hostelId = values.hostelId
      ? this.authService.resolveHostelScope(context, values.organizationId, values.hostelId)
      : undefined

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const payments = await this.paymentsRepository.listPaymentsNeedingInvoiceFinalization(
      values.organizationId,
      hostelId ?? undefined
    )
    const results: Array<{
      paymentId: string
      status: "succeeded" | "failed"
      invoiceId: string | null
      error?: string
    }> = []

    for (const payment of payments.slice(0, values.limit)) {
      try {
        const finalized = await this.finalizeVerifiedPaymentInvoice(
          payment,
          context.authUser.id,
          "payment.invoice_reconciliation_failed"
        )

        results.push({
          paymentId: payment.id,
          status: "succeeded",
          invoiceId: finalized.invoice_id,
        })
      } catch (error) {
        results.push({
          paymentId: payment.id,
          status: "failed",
          invoiceId: payment.invoice_id,
          error: error instanceof Error ? error.message : "Unknown finalization error",
        })
      }
    }

    return {
      processed: results.length,
      succeeded: results.filter((result) => result.status === "succeeded").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    }
  }

  private async publishPaymentVerificationEvents(
    payment: Awaited<ReturnType<PaymentsRepository["verify"]>>,
    actorUserId: string
  ) {
    await this.realtimeService.paymentStatusChanged({
      organizationId: payment.organization_id,
      hostelId: payment.hostel_id,
      actorUserId,
      paymentId: payment.id,
      residentId: payment.resident_id,
      status: payment.status,
    })

    const resident = await this.residentsRepository.getById(
      payment.resident_id,
      payment.organization_id
    )

    try {
      await this.notificationService.queue({
        organizationId: payment.organization_id,
        hostelId: payment.hostel_id,
        channel: "in_app",
        recipient: {
          userId: actorUserId,
        },
        actorUserId,
        message: {
          title:
            payment.method === "cash" ? "Cash collection recorded" : "Payment received",
          body: `${resident?.full_name ?? "Resident"} paid INR ${payment.amount}.`,
          templateKey: "payment_received",
          payload: {
            payment_id: payment.id,
            resident_id: payment.resident_id,
            amount: payment.amount,
            method: payment.method,
            invoice_id: payment.invoice_id,
          },
        },
      })
    } catch (error) {
      logError(error, {
        event: "payment.admin_notification_failed",
        paymentId: payment.id,
        organizationId: payment.organization_id,
      })
    }

    if (!resident) {
      return
    }

    try {
      await this.notificationService.queue({
        organizationId: payment.organization_id,
        hostelId: payment.hostel_id,
        channel: "in_app",
        recipient: {
          residentId: resident.id,
          userId: resident.user_id,
        },
        actorUserId,
        message: {
          title: "Payment received",
          body: `We received and verified your payment of INR ${payment.amount}.`,
          templateKey: "payment_receipt",
          payload: {
            payment_id: payment.id,
            invoice_id: payment.invoice_id,
            amount: payment.amount,
            transaction_id: payment.transaction_id,
          },
        },
      })
    } catch (error) {
      logError(error, {
        event: "payment.receipt_notification_failed",
        paymentId: payment.id,
        organizationId: payment.organization_id,
      })
    }

    if (!resident.email) {
      return
    }

    try {
      const notification = await this.notificationService.queue({
        organizationId: payment.organization_id,
        hostelId: payment.hostel_id,
        channel: "email",
        recipient: {
          residentId: resident.id,
          userId: resident.user_id,
          email: resident.email,
          phone: resident.phone,
        },
        actorUserId,
        message: {
          title: "Your hostel payment has been verified",
          body: `We received and verified your payment of INR ${payment.amount}.`,
          templateKey: "payment_receipt",
          payload: {
            payment_id: payment.id,
            amount: payment.amount,
            transaction_id: payment.transaction_id,
          },
        },
      })

      await this.notificationService.send({
        notification,
        recipient: {
          residentId: resident.id,
          userId: resident.user_id,
          email: resident.email,
          phone: resident.phone,
        },
      })
    } catch (error) {
      logError(error, {
        event: "payment.receipt_email_failed",
        paymentId: payment.id,
        organizationId: payment.organization_id,
      })
    }
  }

  private async withQrSignedUrl(
    setting: PaymentSettingRow
  ): Promise<PaymentSettingView> {
    if (!setting.qr_image_path) {
      return {
        ...setting,
        qrImageSignedUrl: null,
        qrImageSignedUrlExpiresAt: null,
        qrImagePreviewError: null,
      }
    }

    try {
      const expiresInSeconds = 900
      const signedUrlExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      const signedUrl = await this.uploadsRepository.createSignedUrl(
        "payment-qr-codes",
        setting.qr_image_path,
        expiresInSeconds
      )

      return {
        ...setting,
        qrImageSignedUrl: appendQrPreviewCacheBust(signedUrl, {
          storagePath: setting.qr_image_path,
          qrVersion: setting.qr_version,
          updatedAt: setting.qr_replaced_at ?? setting.updated_at,
        }),
        qrImageSignedUrlExpiresAt: signedUrlExpiresAt,
        qrImagePreviewError: null,
      }
    } catch (error) {
      logError(error, {
        event: "payment_settings.qr_signed_url_failed",
        organizationId: setting.organization_id,
        hostelId: setting.hostel_id,
      })
      await this.recordPaymentSettingsAuditLog({
        organizationId: setting.organization_id,
        hostelId: setting.hostel_id,
        actorUserId: setting.updated_by ?? setting.created_by,
        tableName: "payment_settings",
        recordId: setting.id,
        action: "payment_settings.qr_preview_failed",
        oldValues: null,
        newValues: null,
        metadata: {
          bucketName: "payment-qr-codes",
          storagePath: setting.qr_image_path,
          error: error instanceof Error ? error.message : "Unknown signed URL error",
        },
      })

      return {
        ...setting,
        qrImageSignedUrl: null,
        qrImageSignedUrlExpiresAt: null,
        qrImagePreviewError:
          "QR image is saved, but the preview link could not be generated. Retry preview or check storage access.",
      }
    }
  }

  private async recordPaymentSettingsAuditLog(input: {
    organizationId: string
    hostelId: string | null
    actorUserId?: string | null
    tableName: string
    recordId: string | null
    action: string
    oldValues: unknown
    newValues: unknown
    metadata?: Record<string, unknown>
    auditContext?: PaymentSettingsAuditContext
  }) {
    try {
      await this.paymentSettingsRepository.createAuditLog({
        organization_id: input.organizationId,
        hostel_id: input.hostelId,
        actor_user_id: input.actorUserId ?? null,
        table_name: input.tableName,
        record_id: input.recordId,
        action: input.action,
        old_values: input.oldValues as Json,
        new_values: input.newValues as Json,
        ip_address: input.auditContext?.ipAddress ?? null,
        user_agent: input.auditContext?.userAgent ?? null,
        request_id: input.auditContext?.requestId ?? getRequestId(),
        metadata: (input.metadata ?? {}) as Json,
        created_by: input.actorUserId ?? null,
        updated_by: input.actorUserId ?? null,
      })
    } catch (error) {
      logError(error, {
        event: "payment_settings.audit_log_failed",
        organizationId: input.organizationId,
        hostelId: input.hostelId,
        metadata: {
          action: input.action,
          tableName: input.tableName,
        },
      })
    }
  }

  private async assertManualPaymentPolicy(values: {
    organizationId: string
    hostelId: string
    amount: number
    isPartial?: boolean
    isAdvance?: boolean
  }) {
    const setting = await this.paymentSettingsRepository.getActive(
      values.organizationId,
      values.hostelId
    )

    if (!setting) {
      return
    }

    if (values.amount < setting.min_payment_amount) {
      throw conflict(`Payment amount must be at least ${setting.min_payment_amount}.`)
    }

    if (values.isPartial && !setting.allow_partial_payment) {
      throw conflict("Partial payments are disabled for this hostel.")
    }

    if (values.isAdvance && !setting.allow_advance_payment) {
      throw conflict("Advance payments are disabled for this hostel.")
    }
  }

  private async finalizeVerifiedPaymentInvoice(
    payment: PaymentRow,
    actorUserId: string,
    failureEvent: string
  ) {
    await this.paymentsRepository.markInvoiceFinalizationInProgress(
      payment.id,
      payment.organization_id,
      actorUserId
    )

    try {
      const finalized = await this.ensureVerifiedPaymentInvoice(payment, actorUserId)

      if (!finalized.invoice_id) {
        throw conflict("Verified payment must be linked to an invoice before finalization succeeds.")
      }

      return this.paymentsRepository.markInvoiceFinalizationSucceeded(
        finalized.id,
        finalized.organization_id,
        actorUserId
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown invoice finalization error"

      await this.paymentsRepository.markInvoiceFinalizationFailed(
        payment.id,
        payment.organization_id,
        message,
        actorUserId
      )
      logError(error, {
        event: failureEvent,
        paymentId: payment.id,
        organizationId: payment.organization_id,
      })

      throw error
    }
  }

  private async ensureVerifiedPaymentInvoice(
    payment: PaymentRow,
    actorUserId: string
  ) {
    if (payment.monthly_fee_record_id) {
      const invoice =
        await this.invoicesService.generateVerifiedMonthlyFeePaymentInvoice({
          payment,
          actorUserId,
        })

      if (payment.invoice_id === invoice.id) {
        return (
          (await this.paymentsRepository.getById(
            payment.id,
            payment.organization_id
          )) ?? payment
        )
      }

      return this.paymentsRepository.updateInvoiceLink(
        payment.id,
        payment.organization_id,
        invoice.id,
        actorUserId
      )
    }

    if (payment.invoice_id) {
      await this.invoicesService.generatePaymentReceiptInvoice({
        payment,
        actorUserId,
      })

      return (
        (await this.paymentsRepository.getById(
          payment.id,
          payment.organization_id
        )) ?? payment
      )
    }

    const invoice = await this.invoicesService.generatePaymentReceiptInvoice({
      payment,
      actorUserId,
    })

    return this.paymentsRepository.updateInvoiceLink(
      payment.id,
      payment.organization_id,
      invoice.id,
      actorUserId
    )
  }

  private async ensureManualPaymentProof(
    payment: PaymentRow,
    actorUserId: string,
    details: {
      manualReference?: string | null
      notes?: string | null
    }
  ) {
    const existingProof = await this.uploadsRepository.findLatestPaymentProof(
      payment.organization_id,
      payment.id
    )

    if (existingProof) {
      return existingProof
    }

    const file = createManualPaymentReceiptMarker(payment.id)
    const storagePath = [
      payment.organization_id,
      payment.resident_id,
      "manual-payment-receipts",
      `${payment.id}.png`,
    ].join("/")
    const now = new Date().toISOString()

    await this.uploadsRepository.uploadObject(
      "payment-screenshots",
      storagePath,
      file,
      {
        upsert: true,
        cacheControl: "3600",
      }
    )

    return this.uploadsRepository.createDocument({
      organization_id: payment.organization_id,
      hostel_id: payment.hostel_id,
      resident_id: payment.resident_id,
      payment_id: payment.id,
      uploaded_by_user_id: actorUserId,
      document_type: "payment_receipt",
      status: "pending",
      bucket_name: "payment-screenshots",
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      verified_by: null,
      verified_at: null,
      is_public: false,
      metadata: {
        source: "admin_in_person",
        generated_receipt_marker: true,
        method: payment.method,
        amount: payment.amount,
        manual_reference: details.manualReference ?? null,
        notes: details.notes ?? null,
        generated_at: now,
      },
      created_by: actorUserId,
      updated_by: actorUserId,
    })
  }

  private async markManualPaymentProofVerified(
    documentId: string,
    organizationId: string,
    actorUserId: string
  ) {
    return this.uploadsRepository.updateDocument(documentId, organizationId, {
      status: "verified",
      verified_by: actorUserId,
      verified_at: new Date().toISOString(),
      updated_by: actorUserId,
    })
  }

  private async assertPaymentSettingPolicy(values: {
    organizationId: string
    hostelId: string
    amount: number
    isPartial?: boolean
    isAdvance?: boolean
    transactionId?: string
    requireTransactionReference?: boolean
  }) {
    const setting = await this.paymentSettingsRepository.getActive(
      values.organizationId,
      values.hostelId
    )

    if (!setting) {
      throw conflict("Active hostel payment account is not configured.")
    }

    if (values.amount < setting.min_payment_amount) {
      throw conflict(`Payment amount must be at least ${setting.min_payment_amount}.`)
    }

    if (values.isPartial && !setting.allow_partial_payment) {
      throw conflict("Partial payments are disabled for this hostel.")
    }

    if (values.isAdvance && !setting.allow_advance_payment) {
      throw conflict("Advance payments are disabled for this hostel.")
    }

    if (values.requireTransactionReference !== false && setting.require_utr && !values.transactionId) {
      throw conflict("UPI transaction reference is required.")
    }
  }

  private async assertResidentPaymentAmount(values: {
    organizationId: string
    hostelId: string
    residentId: string
    monthlyFeeRecordId?: string | null
    amount: number
    isPartial?: boolean
    isAdvance?: boolean
  }) {
    if (values.isAdvance) {
      return
    }

    const payments = await this.paymentsRepository.listResidentPayments(
      values.organizationId,
      values.residentId,
      { page: 1, pageSize: 100 }
    )

    if (values.monthlyFeeRecordId) {
      const linkedRecord = assertFound(
        await this.paymentsRepository.getFeeRecordById(
          values.organizationId,
          values.monthlyFeeRecordId
        ),
        "Monthly fee record not found."
      )

      if (
        linkedRecord.hostel_id !== values.hostelId ||
        linkedRecord.resident_id !== values.residentId
      ) {
        throw conflict("Payment due record does not match this resident.")
      }

      const advanceAppliedToRecord = payments.data
        .filter(
          (payment) =>
            payment.monthly_fee_record_id === values.monthlyFeeRecordId &&
            payment.status === "verified" &&
            payment.is_advance
        )
        .reduce((total, payment) => total + payment.amount, 0)
      const effectiveBalance =
        linkedRecord.balance_amount > 0
          ? linkedRecord.balance_amount
          : advanceAppliedToRecord > 0
            ? Math.min(linkedRecord.total_amount, advanceAppliedToRecord)
            : linkedRecord.balance_amount

      if (
        !["pending", "partial", "overdue"].includes(linkedRecord.status) &&
        !(linkedRecord.status === "paid" && effectiveBalance > 0)
      ) {
        throw conflict("This due record is not payable anymore.")
      }

      const pendingForRecord = payments.data
        .filter(
          (payment) =>
            payment.monthly_fee_record_id === values.monthlyFeeRecordId &&
            !payment.is_advance &&
            (payment.status === "pending" || payment.status === "initiated")
        )
        .reduce((total, payment) => total + payment.amount, 0)
      const payableForRecord = Math.max(effectiveBalance - pendingForRecord, 0)

      this.assertPayableAmount({
        amount: values.amount,
        payableDue: payableForRecord,
        isPartial: values.isPartial,
      })
      return
    }

    const feeRecords = await this.paymentsRepository.listFeeRecords({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      page: 1,
      pageSize: 100,
    })
    const currentDue = feeRecords.data
      .filter((record) => ["pending", "partial", "overdue"].includes(record.status))
      .reduce((total, record) => total + record.balance_amount, 0)
    const pendingVerification = payments.data
      .filter(
        (payment) =>
          !payment.is_advance &&
          (payment.status === "pending" || payment.status === "initiated")
      )
      .reduce((total, payment) => total + payment.amount, 0)
    const payableDue = Math.max(currentDue - pendingVerification, 0)

    this.assertPayableAmount({
      amount: values.amount,
      payableDue,
      isPartial: values.isPartial,
    })
  }

  private assertPayableAmount(values: {
    amount: number
    payableDue: number
    isPartial?: boolean
  }) {
    if (values.payableDue <= 0) {
      throw conflict(
        "No payable due is available right now. Mark the payment as advance if the hostel accepts advance payments."
      )
    }

    if (values.amount > values.payableDue) {
      throw conflict(
        `Payment amount cannot exceed the payable due of ${values.payableDue}. Mark extra money as advance.`
      )
    }

    if (values.amount < values.payableDue && !values.isPartial) {
      throw conflict("Mark this as partial payment when paying less than the payable due.")
    }
  }

  private validateQrFile(file: File) {
    if (!file || file.size === 0) {
      throw badRequest("A non-empty QR image is required.")
    }

    if (file.size > 2 * 1024 * 1024) {
      throw badRequest("QR image must be 2 MB or smaller.")
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw badRequest("QR image must be a JPEG, PNG, or WebP file.")
    }
  }
}

function appendQrPreviewCacheBust(
  signedUrl: string,
  input: {
    storagePath: string
    qrVersion: number
    updatedAt: string | null
  }
) {
  const updatedAt = input.updatedAt ? Date.parse(input.updatedAt) : Date.now()
  const cacheKey = [
    `qr_version=${encodeURIComponent(String(input.qrVersion))}`,
    `qr_updated=${encodeURIComponent(String(Number.isFinite(updatedAt) ? updatedAt : Date.now()))}`,
    `qr_path=${encodeURIComponent(input.storagePath)}`,
  ].join("&")

  return `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}${cacheKey}`
}

function createScreenshotPaymentReference(idempotencyKey: string) {
  const compactKey = idempotencyKey.replace(/[^A-Za-z0-9]/g, "").slice(0, 32)

  return `SCREENSHOT-${compactKey || crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
}

function isSupabaseQueryClient(db: AppSupabaseClient) {
  return typeof (db as { from?: unknown }).from === "function"
}

function compareFeeRecordsByDueDate(
  left: Tables<"monthly_fee_records">,
  right: Tables<"monthly_fee_records">
) {
  return (
    left.due_date.localeCompare(right.due_date) ||
    left.period_month.localeCompare(right.period_month) ||
    left.created_at.localeCompare(right.created_at)
  )
}

function isDateBefore(left: string, right: string) {
  return left < right
}
