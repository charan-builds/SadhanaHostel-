import "server-only"

import { anyRoleHasPermission } from "@/constants/auth"
import { conflict, forbidden } from "@/lib/api/api-error"
import {
  buildAdvanceAllocationPlan,
  buildAdvanceCoverageTimeline,
  buildAdvanceOwnerDashboard,
  buildAdvanceReports,
  calculateAdvanceBalance,
} from "@/lib/finance/advance-ledger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdvanceLedgerRepository } from "@/repositories/advance-ledger.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type {
  AdvanceLedgerSummary,
  AdvancePaymentMode,
} from "@/types/advance-ledger"
import {
  advanceAllocationRunSchema,
  advanceDepositCreateSchema,
  advanceLedgerQuerySchema,
  advanceRefundApproveSchema,
  advanceRefundCreateSchema,
  advanceReportsSchema,
  advanceSettlementSchema,
} from "@/validations/finance.validation"

import { assertFound, AuthService } from "../auth.service"
import { PaymentsService } from "../payments.service"

export class AdvanceLedgerService {
  private readonly authService: AuthService
  private readonly repository: AdvanceLedgerRepository
  private readonly adminRepository: AdvanceLedgerRepository
  private readonly residentsRepository: ResidentsRepository

  constructor(
    private readonly db: AppSupabaseClient,
    adminDb: AppSupabaseClient = createSupabaseAdminClient()
  ) {
    this.authService = new AuthService(db)
    this.repository = new AdvanceLedgerRepository(db)
    this.adminRepository = new AdvanceLedgerRepository(adminDb)
    this.residentsRepository = new ResidentsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new AdvanceLedgerService(db)
  }

  async recordDeposit(input: unknown) {
    const values = advanceDepositCreateSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const payment = await new PaymentsService(this.db).recordInPersonPayment({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      amount: values.amount,
      method: values.paymentMode,
      idempotencyKey: values.idempotencyKey ?? `advance-deposit-${crypto.randomUUID()}`,
      manualReference: values.transactionId || undefined,
      notes: values.notes || undefined,
      isAdvance: true,
      isPartial: false,
    })

    const deposit = await this.syncVerifiedAdvancePayment(payment.id, values.organizationId)
    await this.allocateForResidentWithActor({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
      actorUserId: context.authUser.id,
      limit: 100,
    })

    return deposit
  }

  async getLedger(input: unknown): Promise<AdvanceLedgerSummary> {
    const values = advanceLedgerQuerySchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    let residentId = values.residentId

    if (!anyRoleHasPermission(context.roles, "finance.manage")) {
      const resident = await this.residentsRepository.getByUserId(
        context.authUser.id,
        values.organizationId
      )

      if (!resident) {
        throw forbidden("Resident profile is required to view advance ledger.")
      }

      if (residentId && residentId !== resident.id) {
        throw forbidden("Residents can only view their own advance ledger.")
      }

      residentId = resident.id
    }

    if (!residentId) {
      throw conflict("residentId is required for advance ledger lookup.")
    }

    const resident = assertFound(
      await this.residentsRepository.getById(residentId, values.organizationId),
      "Resident not found."
    )

    if (anyRoleHasPermission(context.roles, "finance.manage")) {
      this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)
    }

    await this.syncVerifiedAdvancePayments({
      organizationId: values.organizationId,
      hostelId: resident.hostel_id,
      residentId,
    })

    return this.buildResidentSummary({
      organizationId: values.organizationId,
      resident: {
        id: resident.id,
        full_name: resident.full_name,
        hostel_id: resident.hostel_id,
        monthly_fee_amount: resident.monthly_fee_amount,
        joined_on: resident.joined_on,
        status: resident.status,
        checkout_on: resident.checkout_on,
      },
    })
  }

  async allocateAvailableAdvance(input: unknown) {
    const values = advanceAllocationRunSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    return this.allocateForResidentWithActor({
      organizationId: values.organizationId,
      hostelId,
      residentId: values.residentId,
      actorUserId: context.authUser.id,
      limit: values.limit,
    })
  }

  async allocateForResidentSystem(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
    actorUserId?: string | null
    limit?: number
  }) {
    return this.allocateForResidentWithActor({
      organizationId: input.organizationId,
      hostelId: input.hostelId ?? null,
      residentId: input.residentId ?? null,
      actorUserId: input.actorUserId ?? null,
      limit: input.limit ?? 100,
    })
  }

  async requestRefund(input: unknown) {
    const values = advanceRefundCreateSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")

    this.authService.requireHostelAccess(context, values.organizationId, values.hostelId)

    const balance = await this.getResidentBalance({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      residentId: values.residentId,
    })

    if (values.amount > balance.remainingAdvanceBalance) {
      throw conflict("Refund amount exceeds remaining advance balance.")
    }

    const refund = await this.repository.createRefund({
      organization_id: values.organizationId,
      hostel_id: values.hostelId,
      resident_id: values.residentId,
      amount: values.amount,
      reason: values.reason,
      requested_by: context.authUser.id,
      notes: values.notes || null,
      metadata: {
        balance_before_request: balance.remainingAdvanceBalance,
      },
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })

    await this.repository.createRefundAudit({
      organization_id: refund.organization_id,
      hostel_id: refund.hostel_id,
      resident_id: refund.resident_id,
      refund_id: refund.id,
      actor_user_id: context.authUser.id,
      action: "advance_refund.requested",
      old_status: null,
      new_status: refund.status,
      notes: values.notes || null,
      metadata: {
        amount: refund.amount,
        reason: refund.reason,
      },
    })

    return refund
  }

  async approveRefund(input: unknown) {
    const values = advanceRefundApproveSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const refund = assertFound(
      await this.repository.getRefund(values.organizationId, values.refundId),
      "Advance refund not found."
    )

    this.authService.requireHostelAccess(context, refund.organization_id, refund.hostel_id)

    const now = new Date().toISOString()
    const oldStatus = refund.status
    const update: Record<string, unknown> = {
      updated_by: context.authUser.id,
    }

    if (values.action === "approve") {
      if (refund.status !== "requested") {
        throw conflict("Only requested refunds can be approved.")
      }

      const balance = await this.getResidentBalance({
        organizationId: refund.organization_id,
        hostelId: refund.hostel_id,
        residentId: refund.resident_id,
      })

      if (refund.amount > balance.remainingAdvanceBalance) {
        throw conflict("Refund amount exceeds remaining advance balance.")
      }

      update.status = "approved"
      update.approved_by = context.authUser.id
      update.approved_at = now
    }

    if (values.action === "reject") {
      if (refund.status !== "requested") {
        throw conflict("Only requested refunds can be rejected.")
      }

      update.status = "rejected"
      update.notes = values.notes || refund.notes
    }

    if (values.action === "mark_paid") {
      if (refund.status !== "approved") {
        throw conflict("Only approved refunds can be marked paid.")
      }

      update.status = "paid"
      update.paid_by = context.authUser.id
      update.paid_at = now
    }

    const updated = await this.repository.updateRefund({
      organizationId: values.organizationId,
      refundId: values.refundId,
      values: update,
    })

    await this.repository.createRefundAudit({
      organization_id: refund.organization_id,
      hostel_id: refund.hostel_id,
      resident_id: refund.resident_id,
      refund_id: refund.id,
      actor_user_id: context.authUser.id,
      action: `advance_refund.${values.action}`,
      old_status: oldStatus,
      new_status: updated.status,
      notes: values.notes || null,
      metadata: {
        amount: refund.amount,
      },
    })

    return updated
  }

  async getReports(input: unknown) {
    const values = advanceReportsSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    await this.syncVerifiedAdvancePayments({
      organizationId: values.organizationId,
      hostelId,
      residentId: values.residentId,
    })

    const residents = values.residentId
      ? [
          assertFound(
            await this.residentsRepository.getById(values.residentId, values.organizationId),
            "Resident not found."
          ),
        ].map((resident) => ({
          id: resident.id,
          full_name: resident.full_name,
          hostel_id: resident.hostel_id,
          monthly_fee_amount: resident.monthly_fee_amount,
          joined_on: resident.joined_on,
          status: resident.status,
          checkout_on: resident.checkout_on,
        }))
      : await this.repository.listResidents(values.organizationId, hostelId)

    const [deposits, allocations, refunds] = await Promise.all([
      this.repository.listDeposits({
        organizationId: values.organizationId,
        hostelId,
        residentId: values.residentId,
      }),
      this.repository.listAllocations({
        organizationId: values.organizationId,
        hostelId,
        residentId: values.residentId,
      }),
      this.repository.listRefunds({
        organizationId: values.organizationId,
        hostelId,
        residentId: values.residentId,
      }),
    ])

    return buildAdvanceReports({
      residents,
      deposits,
      allocations,
      refunds,
    })
  }

  async getOwnerDashboard(input: unknown) {
    const reports = await this.getReports(input)

    return buildAdvanceOwnerDashboard({ reports })
  }

  async getSettlement(input: unknown) {
    const values = advanceSettlementSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const resident = assertFound(
      await this.residentsRepository.getById(values.residentId, values.organizationId),
      "Resident not found."
    )

    this.authService.requireHostelAccess(context, resident.organization_id, resident.hostel_id)

    await this.allocateForResidentWithActor({
      organizationId: values.organizationId,
      hostelId: resident.hostel_id,
      residentId: resident.id,
      actorUserId: context.authUser.id,
      limit: 100,
    })

    const ledger = await this.buildResidentSummary({
      organizationId: values.organizationId,
      resident: {
        id: resident.id,
        full_name: resident.full_name,
        hostel_id: resident.hostel_id,
        monthly_fee_amount: resident.monthly_fee_amount,
        joined_on: resident.joined_on,
        status: resident.status,
        checkout_on: resident.checkout_on,
      },
    })

    return {
      resident: ledger.resident,
      totalAdvance: ledger.balance.totalAdvanceReceived,
      consumed: ledger.balance.totalAdvanceConsumed,
      remaining: ledger.balance.remainingAdvanceBalance,
      refundable: ledger.balance.remainingAdvanceBalance,
      coveredUntil: ledger.coveredUntil,
      nextDueDate: ledger.nextDueDate,
      refunds: ledger.refunds,
    }
  }

  private async allocateForResidentWithActor(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
    actorUserId?: string | null
    limit: number
  }) {
    await this.syncVerifiedAdvancePayments(input)

    const targetResidents = input.residentId
      ? [
          assertFound(
            await this.residentsRepository.getById(input.residentId, input.organizationId),
            "Resident not found."
          ),
        ]
      : await this.adminRepository.listResidents(input.organizationId, input.hostelId)
    const results: Array<{
      residentId: string
      consumedAmount: number
      allocationCount: number
      endingBalance: number
    }> = []
    let processed = 0

    for (const resident of targetResidents) {
      if (processed >= input.limit) {
        break
      }

      const residentId = resident.id
      const balance = await this.getResidentBalance({
        organizationId: input.organizationId,
        hostelId: resident.hostel_id,
        residentId,
      })

      if (balance.remainingAdvanceBalance <= 0) {
        continue
      }

      const feeRecords = await this.adminRepository.listOpenFeeRecords({
        organizationId: input.organizationId,
        hostelId: resident.hostel_id,
        residentId,
      })
      const plan = buildAdvanceAllocationPlan({
        availableBalance: balance.remainingAdvanceBalance,
        feeRecords,
      })

      for (const item of plan.items) {
        const feeRecord = feeRecords.find((record) => record.id === item.monthlyFeeRecordId)

        if (!feeRecord) {
          continue
        }

        await this.adminRepository.createAllocation({
          organization_id: input.organizationId,
          hostel_id: resident.hostel_id,
          resident_id: residentId,
          monthly_fee_record_id: item.monthlyFeeRecordId,
          period_month: item.periodMonth,
          amount: item.allocationAmount,
          allocated_by: input.actorUserId ?? null,
          metadata: {
            source: "advance_auto_allocation",
            due_date: item.dueDate,
            before_balance: item.beforeBalance,
            after_balance: item.afterBalance,
          },
          created_by: input.actorUserId ?? null,
          updated_by: input.actorUserId ?? null,
        })
        await this.adminRepository.updateFeeRecordForAdvanceAllocation({
          organizationId: input.organizationId,
          feeRecord,
          allocationAmount: item.allocationAmount,
          actorUserId: input.actorUserId ?? null,
        })
        await this.adminRepository.updateInvoicesForAdvanceAllocation({
          organizationId: input.organizationId,
          monthlyFeeRecordId: item.monthlyFeeRecordId,
          allocationAmount: item.allocationAmount,
          actorUserId: input.actorUserId ?? null,
        })
      }

      processed += 1
      results.push({
        residentId,
        consumedAmount: plan.consumedAmount,
        allocationCount: plan.items.length,
        endingBalance: plan.endingBalance,
      })
    }

    return {
      processed,
      results,
    }
  }

  private async buildResidentSummary(input: {
    organizationId: string
    resident: {
      id: string
      full_name: string
      hostel_id: string
      monthly_fee_amount: number
      joined_on: string | null
      status?: string | null
      checkout_on?: string | null
    }
  }): Promise<AdvanceLedgerSummary> {
    const [deposits, allocations, refunds] = await Promise.all([
      this.repository.listDeposits({
        organizationId: input.organizationId,
        hostelId: input.resident.hostel_id,
        residentId: input.resident.id,
      }),
      this.repository.listAllocations({
        organizationId: input.organizationId,
        hostelId: input.resident.hostel_id,
        residentId: input.resident.id,
      }),
      this.repository.listRefunds({
        organizationId: input.organizationId,
        hostelId: input.resident.hostel_id,
        residentId: input.resident.id,
      }),
    ])
    const balance = calculateAdvanceBalance({ deposits, allocations, refunds })
    const timeline = buildAdvanceCoverageTimeline({
      resident: input.resident,
      balance,
      months: 12,
    })

    return {
      resident: input.resident,
      balance,
      coveredMonths: timeline.coveredMonths,
      coveredUntil: timeline.coveredUntil,
      nextDueDate: timeline.nextDueDate,
      deposits,
      allocations,
      refunds,
    }
  }

  private async getResidentBalance(input: {
    organizationId: string
    hostelId: string
    residentId: string
  }) {
    const [deposits, allocations, refunds] = await Promise.all([
      this.adminRepository.listDeposits(input),
      this.adminRepository.listAllocations(input),
      this.adminRepository.listRefunds(input),
    ])

    return calculateAdvanceBalance({ deposits, allocations, refunds })
  }

  private async syncVerifiedAdvancePayment(paymentId: string, organizationId: string) {
    const payments = await this.adminRepository.listVerifiedAdvancePayments({
      organizationId,
    })
    const payment = payments.find((item) => item.id === paymentId)

    if (!payment) {
      throw conflict("Verified advance payment could not be synced into the ledger.")
    }

    return this.ensureDepositForPayment(payment)
  }

  private async syncVerifiedAdvancePayments(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
  }) {
    const payments = await this.adminRepository.listVerifiedAdvancePayments(input)

    for (const payment of payments) {
      await this.ensureDepositForPayment(payment)
    }
  }

  private async ensureDepositForPayment(
    payment: Awaited<ReturnType<AdvanceLedgerRepository["listVerifiedAdvancePayments"]>>[number]
  ) {
    const existing = await this.adminRepository.findDepositByPaymentId(
      payment.organization_id,
      payment.id
    )

    if (existing) {
      return existing
    }

    return this.adminRepository.createDeposit({
      organization_id: payment.organization_id,
      hostel_id: payment.hostel_id,
      resident_id: payment.resident_id,
      payment_id: payment.id,
      amount: payment.amount,
      payment_mode: payment.method as AdvancePaymentMode,
      transaction_id: payment.transaction_id ?? payment.manual_reference,
      received_date: (payment.paid_at ?? payment.verified_at ?? new Date().toISOString()).slice(
        0,
        10
      ),
      received_by: payment.received_by,
      notes: payment.notes,
      status: "received",
      metadata: {
        source: "verified_advance_payment_sync",
        payment_id: payment.id,
      },
      created_by: payment.created_by,
      updated_by: payment.updated_by,
    })
  }
}
