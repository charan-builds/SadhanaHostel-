import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import { logError, logPaymentEvent } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PaymentsRepository } from "@/repositories/payments.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import { UploadsRepository } from "@/repositories/uploads.repository"
import {
  createPaymentSchema,
  generateMonthlyFeeSchema,
  paymentListSchema,
  submitUpiPaymentSchema,
  verifyPaymentSchema,
} from "@/validations/payment.validation"

import { assertFound, AuthService } from "./auth.service"
import { InvoicesService } from "./invoices"
import { NotificationService } from "./notifications"
import { RealtimeService } from "./realtime"
import { UploadsService } from "./uploads.service"

export class PaymentsService {
  private readonly authService: AuthService
  private readonly paymentsRepository: PaymentsRepository
  private readonly residentsRepository: ResidentsRepository
  private readonly uploadsRepository: UploadsRepository
  private readonly uploadsService: UploadsService
  private readonly invoicesService: InvoicesService
  private readonly notificationService: NotificationService
  private readonly realtimeService: RealtimeService

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
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

    if (!context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role))) {
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

    return this.paymentsRepository.list(values)
  }

  async recordManualPayment(input: unknown) {
    const values = createPaymentSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

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
    const isFinanceUser = context.roles.some((role) =>
      [...ADMIN_ROLES, "staff"].includes(role)
    )

    if (!isFinanceUser && resident.user_id !== context.authUser.id) {
      throw forbidden("Residents can only submit payments for their own profile.")
    }

    if (resident.hostel_id !== values.hostelId) {
      throw conflict("Payment hostel does not match resident hostel.")
    }

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
    const isFinanceUser = context.roles.some((role) =>
      [...ADMIN_ROLES, "staff"].includes(role)
    )

    if (!isFinanceUser && existingResident.user_id !== context.authUser.id) {
      throw forbidden("Residents can only create their own payment records.")
    }

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

    if (!context.roles.some((role) => [...ADMIN_ROLES, "staff"].includes(role))) {
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

  async verifyPayment(input: unknown) {
    const values = verifyPaymentSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const payment = await this.paymentsRepository.getById(
      values.paymentId,
      values.organizationId
    )

    const existingPayment = assertFound(payment, "Payment not found.")

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

  async generateMonthlyFee(input: unknown) {
    const values = generateMonthlyFeeSchema.parse(input)
    const context = await this.authService.requireRole(ADMIN_ROLES)

    this.authService.requireOrganizationAccess(context, values.organizationId)

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
}
