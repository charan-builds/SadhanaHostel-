import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import { logPaymentEvent } from "@/lib/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PaymentsRepository } from "@/repositories/payments.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  createPaymentSchema,
  generateMonthlyFeeSchema,
  paymentListSchema,
  verifyPaymentSchema,
} from "@/validations/payment.validation"

import { assertFound, AuthService } from "./auth.service"

export class PaymentsService {
  private readonly authService: AuthService
  private readonly paymentsRepository: PaymentsRepository
  private readonly residentsRepository: ResidentsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.paymentsRepository = new PaymentsRepository(db)
    this.residentsRepository = new ResidentsRepository(db)
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
      manual_reference: values.manualReference,
      notes: values.notes,
      is_advance: values.isAdvance,
      is_partial: values.isPartial,
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

    const payment = await this.paymentsRepository.create({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      resident_id: values.residentId,
      monthly_fee_record_id: values.monthlyFeeRecordId,
      invoice_id: values.invoiceId,
      amount: values.amount,
      method: "upi",
      status: "pending",
      transaction_id: values.transactionId,
      manual_reference: values.manualReference,
      notes: values.notes,
      is_advance: values.isAdvance,
      is_partial: values.isPartial,
      provider: "upi",
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
        provider: payment.provider,
      },
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

    const verifiedPayment = await this.paymentsRepository.verify(
      values.paymentId,
      values.organizationId,
      context.authUser.id
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
}
