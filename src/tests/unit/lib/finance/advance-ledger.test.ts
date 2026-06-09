import { describe, expect, it } from "vitest"

import {
  buildAdvanceAllocationPlan,
  buildAdvanceCoverageTimeline,
  calculateAdvanceBalance,
} from "@/lib/finance/advance-ledger"
import type {
  AdvanceFeeRecord,
  AdvanceLedgerResident,
} from "@/types/advance-ledger"

describe("advance ledger helpers", () => {
  const resident: AdvanceLedgerResident = {
    id: "resident-1",
    full_name: "Advance Resident",
    hostel_id: "hostel-1",
    monthly_fee_amount: 5000,
    joined_on: "2026-06-05",
  }

  it("projects a 25000 advance as five fully covered months", () => {
    const timeline = buildAdvanceCoverageTimeline({
      resident,
      balance: {
        totalAdvanceReceived: 25000,
        totalAdvanceConsumed: 0,
        totalAdvanceRefunded: 0,
        remainingAdvanceBalance: 25000,
      },
      today: "2026-06-09",
      months: 5,
    })

    expect(timeline.coveredUntil).toBe("October 2026")
    expect(timeline.nextDueDate).toBeNull()
    expect(timeline.coveredMonths.map((month) => month.status)).toEqual([
      "covered",
      "covered",
      "covered",
      "covered",
      "covered",
    ])
    expect(
      timeline.coveredMonths.reduce(
        (total, month) => total + month.coveredAmount,
        0
      )
    ).toBe(25000)
  })

  it("projects partial coverage and the next due date for a 12000 advance", () => {
    const timeline = buildAdvanceCoverageTimeline({
      resident,
      balance: {
        totalAdvanceReceived: 12000,
        totalAdvanceConsumed: 0,
        totalAdvanceRefunded: 0,
        remainingAdvanceBalance: 12000,
      },
      today: "2026-06-09",
      months: 3,
    })

    expect(timeline.coveredUntil).toBe("July 2026")
    expect(timeline.nextDueDate).toBe("2026-08-05")
    expect(timeline.coveredMonths.map((month) => month.status)).toEqual([
      "covered",
      "covered",
      "partial",
    ])
    expect(timeline.coveredMonths[2]).toMatchObject({
      coveredAmount: 2000,
      outstandingAmount: 3000,
    })
  })

  it("allocates available advance oldest fee first and leaves partial dues", () => {
    const plan = buildAdvanceAllocationPlan({
      availableBalance: 12000,
      feeRecords: [
        feeRecord("fee-july", "2026-07-01"),
        feeRecord("fee-august", "2026-08-01"),
        feeRecord("fee-june", "2026-06-01"),
      ],
    })

    expect(plan).toMatchObject({
      startingBalance: 12000,
      consumedAmount: 12000,
      endingBalance: 0,
    })
    expect(plan.items.map((item) => item.monthlyFeeRecordId)).toEqual([
      "fee-june",
      "fee-july",
      "fee-august",
    ])
    expect(plan.items[2]).toMatchObject({
      allocationAmount: 2000,
      afterBalance: 3000,
      status: "partial",
    })
  })

  it("keeps refunded approved advance out of remaining liability", () => {
    const balance = calculateAdvanceBalance({
      deposits: [
        { amount: 50000, status: "received", deleted_at: null },
        { amount: 10000, status: "voided", deleted_at: null },
      ],
      allocations: [
        { amount: 15000, allocation_status: "applied", deleted_at: null },
        { amount: 5000, allocation_status: "reversed", deleted_at: null },
      ],
      refunds: [
        { amount: 10000, status: "approved", deleted_at: null },
        { amount: 4000, status: "requested", deleted_at: null },
      ],
    })

    expect(balance).toEqual({
      totalAdvanceReceived: 50000,
      totalAdvanceConsumed: 15000,
      totalAdvanceRefunded: 10000,
      remainingAdvanceBalance: 25000,
    })
  })
})

function feeRecord(id: string, periodMonth: string): AdvanceFeeRecord {
  return {
    id,
    organization_id: "org-1",
    hostel_id: "hostel-1",
    resident_id: "resident-1",
    period_month: periodMonth,
    due_date: periodMonth.replace("-01", "-05"),
    total_amount: 5000,
    paid_amount: 0,
    balance_amount: 5000,
    advance_adjustment_amount: 0,
    status: "pending",
  }
}
