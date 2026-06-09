import { PaymentsRepository } from "@/repositories/payments.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import { billingDayFromJoinedOn, buildBillingDateForMonth } from "@/lib/finance/billing-date"
import { logError } from "@/lib/logger"
import { AdvanceLedgerService } from "@/services/advance-ledger"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type MonthlyFeeGenerationPayload = OrganizationJobPayload & {
  periodMonth: string
}

export const monthlyFeeGenerationJob: JobDefinition<MonthlyFeeGenerationPayload> = {
  name: "monthly_fee_generation",
  queueName: "finance",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    [
      "monthly_fee_generation",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.periodMonth,
    ].join(":"),
  async run(payload, context) {
    const residentsRepository = new ResidentsRepository(context.db)
    const paymentsRepository = new PaymentsRepository(context.db)
    const advanceLedgerService = new AdvanceLedgerService(context.db, context.db)
    const residents = await residentsRepository.listActiveForBilling(
      payload.organizationId,
      payload.hostelId
    )
    let processed = 0
    let skipped = 0
    let allocationFailures = 0

    for (const resident of residents) {
      const existing = await paymentsRepository.findFeeRecordByResidentPeriod(
        payload.organizationId,
        resident.id,
        payload.periodMonth
      )

      if (existing) {
        skipped += 1
        continue
      }

      const baseAmount = resident.monthly_fee_amount
      const dueDate = buildBillingDateForMonth(
        payload.periodMonth,
        billingDayFromJoinedOn(resident.joined_on)
      )

      await paymentsRepository.createFeeRecord({
        organization_id: payload.organizationId,
        hostel_id: resident.hostel_id,
        resident_id: resident.id,
        room_allocation_id: null,
        period_month: payload.periodMonth,
        due_date: dueDate,
        base_amount: baseAmount,
        total_amount: baseAmount,
        balance_amount: baseAmount,
        status: baseAmount === 0 ? "paid" : "pending",
        metadata: {
          job_run_id: context.runId,
          idempotency_key: context.idempotencyKey,
        },
      })

      if (isSupabaseQueryClient(context.db)) {
        try {
          await advanceLedgerService.allocateForResidentSystem({
            organizationId: payload.organizationId,
            hostelId: resident.hostel_id,
            residentId: resident.id,
            actorUserId: context.requestedBy,
            limit: 1,
          })
        } catch (error) {
          allocationFailures += 1
          logError(error, {
            event: "advance_ledger.auto_allocation_after_monthly_job_failed",
            organizationId: payload.organizationId,
            hostelId: resident.hostel_id,
            residentId: resident.id,
            periodMonth: payload.periodMonth,
            runId: context.runId,
          })
        }
      }

      processed += 1
    }

    return {
      status: "completed",
      processed,
      skipped,
      failed: 0,
      message: "Monthly fee records generated.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        periodMonth: payload.periodMonth,
        residentCount: residents.length,
        allocationFailures,
      },
    }
  },
}

function isSupabaseQueryClient(db: unknown) {
  return typeof (db as { from?: unknown }).from === "function"
}
