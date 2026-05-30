import "server-only"

import { anyRoleHasPermission } from "@/constants/auth"
import { badRequest, conflict, forbidden } from "@/lib/api/api-error"
import { logError, logPaymentEvent } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getRequestId } from "@/lib/tracing"
import { PaymentSettingsRepository } from "@/repositories/payment-settings.repository"
import { PaymentsRepository } from "@/repositories/payments.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import type {
  PaymentSettingRow,
  PaymentSettingView,
} from "@/types/payment-operations"
import type { Json } from "@/types/database"
import {
  createPaymentSchema,
  generateMonthlyFeeSchema,
  paymentQrUploadSchema,
  paymentListSchema,
  paymentSettingsHistorySchema,
  paymentSettingsQuerySchema,
  paymentSettingsSchema,
  paymentSettingsTestSchema,
  rejectPaymentSchema,
  residentPaymentLedgerSchema,
  submitUpiPaymentSchema,
  verifyPaymentSchema,
} from "@/validations/payment.validation"

import { assertFound, AuthService } from "./auth.service"
import { InvoicesService } from "./invoices"
import { NotificationService } from "./notifications"
import { isResidentOperationallyVerified } from "./onboarding/resident-onboarding.policy"
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

    if (!isFinanceUser && !isResidentOperationallyVerified(resident)) {
      throw forbidden("Complete resident onboarding verification before submitting payments.")
    }

    if (resident.hostel_id !== values.hostelId) {
      throw conflict("Payment hostel does not match resident hostel.")
    }

    if (isFinanceUser) {
      this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)
    }

    await this.assertPaymentSettingPolicy(values)

    let payment = await this.paymentsRepository.createResidentUpiDraft({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      monthlyFeeRecordId: values.monthlyFeeRecordId,
      amount: values.amount,
      transactionId: values.transactionId,
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

    const unpaidFeeRecords = feeRecords.data.filter((record) =>
      ["pending", "partial", "overdue"].includes(record.status)
    )
    const currentDue = unpaidFeeRecords.reduce(
      (total, record) => total + record.balance_amount,
      0
    )
    const overdue = unpaidFeeRecords
      .filter((record) => record.status === "overdue")
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
      },
      totals: {
        currentDue,
        overdue,
        pendingVerification,
        verifiedPaid,
        advanceBalance,
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
      throw conflict("Payment is already verified.")
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

    if (verifiedPayment.monthly_fee_record_id) {
      try {
        await this.invoicesService.generateMonthlyFeeInvoice({
          organizationId: values.organizationId,
          monthlyFeeRecordId: verifiedPayment.monthly_fee_record_id,
        })
        verifiedPayment =
          (await this.paymentsRepository.getById(
            verifiedPayment.id,
            verifiedPayment.organization_id
          )) ?? verifiedPayment
      } catch (error) {
        logError(error, {
          event: "payment.invoice_generation_after_verification_failed",
          paymentId: verifiedPayment.id,
          organizationId: verifiedPayment.organization_id,
        })
      }
    }

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

    const totalAmount =
      values.baseAmount +
      values.penaltyAmount +
      values.adjustmentAmount -
      values.discountAmount -
      values.advanceAdjustmentAmount

    if (totalAmount < 0) {
      throw conflict("Calculated fee total cannot be negative.")
    }

    return this.paymentsRepository.createFeeRecord({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      resident_id: values.residentId,
      room_allocation_id: values.roomAllocationId,
      period_month: values.periodMonth,
      due_date: values.dueDate,
      base_amount: values.baseAmount,
      discount_amount: values.discountAmount,
      penalty_amount: values.penaltyAmount,
      adjustment_amount: values.adjustmentAmount,
      advance_adjustment_amount: values.advanceAdjustmentAmount,
      total_amount: totalAmount,
      balance_amount: totalAmount,
      status: totalAmount === 0 ? "paid" : "pending",
      notes: values.notes,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
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

    if (!resident?.email) {
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

  private async assertPaymentSettingPolicy(values: {
    organizationId: string
    hostelId: string
    amount: number
    isPartial?: boolean
    isAdvance?: boolean
    transactionId?: string
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

    if (setting.require_utr && !values.transactionId) {
      throw conflict("UPI transaction reference is required.")
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
