import {
  buildBillingDateForMonth,
  billingDayFromJoinedOn,
  parseDateOnly,
  toPeriodMonth,
} from "@/lib/finance/billing-date"
import type {
  AdvanceAgingBucket,
  AdvanceAllocationPlan,
  AdvanceBalanceSnapshot,
  AdvanceCoverageMonth,
  AdvanceCoverageTimeline,
  AdvanceFeeRecord,
  AdvanceLedgerResident,
  AdvanceLiabilityReportRow,
  AdvanceOwnerDashboard,
  AdvancePaymentAllocationRow,
  AdvancePaymentDepositRow,
  AdvancePaymentRefundRow,
  AdvanceRefundReportRow,
  AdvanceReports,
  AdvanceUtilizationReportRow,
} from "@/types/advance-ledger"

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function calculateAdvanceBalance(input: {
  deposits: Pick<AdvancePaymentDepositRow, "amount" | "status" | "deleted_at">[]
  allocations: Pick<
    AdvancePaymentAllocationRow,
    "amount" | "allocation_status" | "deleted_at"
  >[]
  refunds: Pick<AdvancePaymentRefundRow, "amount" | "status" | "deleted_at">[]
}): AdvanceBalanceSnapshot {
  const totalAdvanceReceived = sum(
    input.deposits
      .filter((deposit) => deposit.status === "received" && deposit.deleted_at === null)
      .map((deposit) => deposit.amount)
  )
  const totalAdvanceConsumed = sum(
    input.allocations
      .filter(
        (allocation) =>
          allocation.allocation_status === "applied" && allocation.deleted_at === null
      )
      .map((allocation) => allocation.amount)
  )
  const totalAdvanceRefunded = sum(
    input.refunds
      .filter(
        (refund) =>
          ["approved", "paid"].includes(refund.status) && refund.deleted_at === null
      )
      .map((refund) => refund.amount)
  )

  return {
    totalAdvanceReceived,
    totalAdvanceConsumed,
    totalAdvanceRefunded,
    remainingAdvanceBalance: Math.max(
      0,
      roundMoney(totalAdvanceReceived - totalAdvanceConsumed - totalAdvanceRefunded)
    ),
  }
}

export function buildAdvanceAllocationPlan(input: {
  availableBalance: number
  feeRecords: AdvanceFeeRecord[]
}): AdvanceAllocationPlan {
  let balance = roundMoney(input.availableBalance)
  const items: AdvanceAllocationPlan["items"] = []

  for (const feeRecord of input.feeRecords.toSorted(compareFeeRecords)) {
    if (balance <= 0) {
      break
    }

    if (!isOpenFeeRecord(feeRecord)) {
      continue
    }

    const allocationAmount = Math.min(balance, feeRecord.balance_amount)

    if (allocationAmount <= 0) {
      continue
    }

    const afterBalance = roundMoney(feeRecord.balance_amount - allocationAmount)

    items.push({
      monthlyFeeRecordId: feeRecord.id,
      periodMonth: feeRecord.period_month,
      dueDate: feeRecord.due_date,
      beforeBalance: feeRecord.balance_amount,
      allocationAmount: roundMoney(allocationAmount),
      afterBalance,
      status: afterBalance === 0 ? "covered" : "partial",
    })

    balance = roundMoney(balance - allocationAmount)
  }

  return {
    startingBalance: roundMoney(input.availableBalance),
    consumedAmount: sum(items.map((item) => item.allocationAmount)),
    endingBalance: balance,
    items,
  }
}

export function buildAdvanceCoverageTimeline(input: {
  resident: AdvanceLedgerResident
  balance: AdvanceBalanceSnapshot
  today?: string
  months?: number
}): AdvanceCoverageTimeline {
  const months = Math.max(1, input.months ?? 12)
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const billingDay = billingDayFromJoinedOn(input.resident.joined_on)
  const monthlyFee = Math.max(0, input.resident.monthly_fee_amount)
  let remaining = input.balance.remainingAdvanceBalance
  const start = parseDateOnly(toPeriodMonth(parseDateOnly(today)))
  const coveredMonths: AdvanceCoverageMonth[] = []

  for (let index = 0; index < months; index += 1) {
    const period = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1))
    const periodMonth = toPeriodMonth(period)
    const coveredAmount = Math.min(remaining, monthlyFee)
    const outstandingAmount = Math.max(0, monthlyFee - coveredAmount)

    coveredMonths.push({
      periodMonth,
      label: monthLabel(periodMonth),
      requiredAmount: monthlyFee,
      coveredAmount: roundMoney(coveredAmount),
      outstandingAmount: roundMoney(outstandingAmount),
      status:
        monthlyFee === 0 || coveredAmount >= monthlyFee
          ? "covered"
          : coveredAmount > 0
            ? "partial"
            : "uncovered",
    })

    remaining = roundMoney(remaining - coveredAmount)
  }

  const lastCovered = [...coveredMonths]
    .reverse()
    .find((month) => month.status === "covered")
  const nextDue = coveredMonths.find((month) => month.status !== "covered")

  return {
    balance: input.balance,
    coveredMonths,
    coveredUntil: lastCovered?.label ?? null,
    nextDueDate: nextDue
      ? buildBillingDateForMonth(nextDue.periodMonth, billingDay)
      : null,
  }
}

export function buildAdvanceReports(input: {
  residents: AdvanceLedgerResident[]
  deposits: AdvancePaymentDepositRow[]
  allocations: AdvancePaymentAllocationRow[]
  refunds: AdvancePaymentRefundRow[]
  today?: string
}): AdvanceReports {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const depositsByResident = groupBy(input.deposits, (deposit) => deposit.resident_id)
  const allocationsByResident = groupBy(
    input.allocations,
    (allocation) => allocation.resident_id
  )
  const refundsByResident = groupBy(input.refunds, (refund) => refund.resident_id)
  const residentById = new Map(input.residents.map((resident) => [resident.id, resident]))
  const liability: AdvanceLiabilityReportRow[] = input.residents
    .map((resident) => {
      const balance = calculateAdvanceBalance({
        deposits: depositsByResident.get(resident.id) ?? [],
        allocations: allocationsByResident.get(resident.id) ?? [],
        refunds: refundsByResident.get(resident.id) ?? [],
      })
      const timeline = buildAdvanceCoverageTimeline({
        resident,
        balance,
        today,
        months: 12,
      })

      return {
        residentId: resident.id,
        residentName: resident.full_name,
        hostelId: resident.hostel_id,
        totalAdvanceReceived: balance.totalAdvanceReceived,
        totalAdvanceConsumed: balance.totalAdvanceConsumed,
        totalAdvanceRefunded: balance.totalAdvanceRefunded,
        remainingAdvanceBalance: balance.remainingAdvanceBalance,
        coveredUntil: timeline.coveredUntil,
      }
    })
    .filter((row) => row.totalAdvanceReceived > 0 || row.remainingAdvanceBalance > 0)
    .toSorted((left, right) => right.remainingAdvanceBalance - left.remainingAdvanceBalance)

  return {
    liability,
    aging: buildAdvanceAgingBuckets(input.deposits, input.allocations, input.refunds, today),
    utilization: buildAdvanceUtilization(input.allocations),
    refunds: input.refunds
      .filter((refund) => refund.deleted_at === null)
      .map<AdvanceRefundReportRow>((refund) => {
        const resident = residentById.get(refund.resident_id)

        return {
          refundId: refund.id,
          residentId: refund.resident_id,
          residentName: resident?.full_name ?? "Resident",
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason,
          requestedAt: refund.created_at,
          approvedAt: refund.approved_at,
          paidAt: refund.paid_at,
        }
      })
      .toSorted((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
  }
}

export function buildAdvanceOwnerDashboard(input: {
  reports: AdvanceReports
  expiryLimit?: number
}): AdvanceOwnerDashboard {
  const liability = input.reports.liability
  const upcomingAdvanceExpiry = liability
    .filter((row) => row.remainingAdvanceBalance > 0)
    .toSorted((left, right) =>
      String(left.coveredUntil ?? "").localeCompare(String(right.coveredUntil ?? "")) ||
      left.remainingAdvanceBalance - right.remainingAdvanceBalance
    )
    .slice(0, input.expiryLimit ?? 10)
    .map((row) => ({
      residentId: row.residentId,
      residentName: row.residentName,
      coveredUntil: row.coveredUntil,
      remainingAdvanceBalance: row.remainingAdvanceBalance,
    }))

  return {
    totalAdvanceLiability: sum(liability.map((row) => row.remainingAdvanceBalance)),
    residentsCoveredByAdvance: liability.filter((row) => row.remainingAdvanceBalance > 0)
      .length,
    upcomingAdvanceExpiry,
  }
}

export function monthLabel(periodMonth: string) {
  return MONTH_LABEL_FORMATTER.format(parseDateOnly(periodMonth))
}

function buildAdvanceAgingBuckets(
  deposits: AdvancePaymentDepositRow[],
  allocations: AdvancePaymentAllocationRow[],
  refunds: AdvancePaymentRefundRow[],
  today: string
): AdvanceAgingBucket[] {
  const depositsByResident = groupBy(deposits, (deposit) => deposit.resident_id)
  const allocationsByResident = groupBy(allocations, (allocation) => allocation.resident_id)
  const refundsByResident = groupBy(refunds, (refund) => refund.resident_id)
  const buckets: AdvanceAgingBucket[] = [
    { label: "0-30 days", minDays: 0, maxDays: 30, residentCount: 0, amount: 0 },
    { label: "31-60 days", minDays: 31, maxDays: 60, residentCount: 0, amount: 0 },
    { label: "61-90 days", minDays: 61, maxDays: 90, residentCount: 0, amount: 0 },
    { label: "90+ days", minDays: 91, maxDays: null, residentCount: 0, amount: 0 },
  ]

  for (const [residentId, residentDeposits] of depositsByResident) {
    const balance = calculateAdvanceBalance({
      deposits: residentDeposits,
      allocations: allocationsByResident.get(residentId) ?? [],
      refunds: refundsByResident.get(residentId) ?? [],
    })

    if (balance.remainingAdvanceBalance <= 0) {
      continue
    }

    const oldestDeposit = residentDeposits
      .filter((deposit) => deposit.status === "received" && deposit.deleted_at === null)
      .toSorted((left, right) => left.received_date.localeCompare(right.received_date))[0]
    const ageDays = oldestDeposit ? daysBetween(oldestDeposit.received_date, today) : 0
    const bucket =
      buckets.find(
        (item) =>
          ageDays >= item.minDays && (item.maxDays === null || ageDays <= item.maxDays)
      ) ?? buckets.at(-1)

    if (!bucket) {
      continue
    }

    bucket.residentCount += 1
    bucket.amount = roundMoney(bucket.amount + balance.remainingAdvanceBalance)
  }

  return buckets
}

function buildAdvanceUtilization(
  allocations: AdvancePaymentAllocationRow[]
): AdvanceUtilizationReportRow[] {
  const byMonth = new Map<string, AdvancePaymentAllocationRow[]>()

  for (const allocation of allocations) {
    if (allocation.deleted_at !== null || allocation.allocation_status !== "applied") {
      continue
    }

    const month = allocation.period_month.slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), allocation])
  }

  return Array.from(byMonth.entries())
    .map(([month, monthAllocations]) => ({
      month,
      consumedAmount: sum(monthAllocations.map((allocation) => allocation.amount)),
      allocationCount: monthAllocations.length,
    }))
    .toSorted((left, right) => right.month.localeCompare(left.month))
}

function isOpenFeeRecord(feeRecord: AdvanceFeeRecord) {
  return (
    feeRecord.balance_amount > 0 &&
    ["pending", "partial", "overdue"].includes(feeRecord.status)
  )
}

function compareFeeRecords(left: AdvanceFeeRecord, right: AdvanceFeeRecord) {
  return (
    left.period_month.localeCompare(right.period_month) ||
    left.due_date.localeCompare(right.due_date) ||
    left.id.localeCompare(right.id)
  )
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const result = new Map<string, T[]>()

  for (const item of items) {
    const key = getKey(item)
    result.set(key, [...(result.get(key) ?? []), item])
  }

  return result
}

function daysBetween(from: string, to: string) {
  return Math.max(
    0,
    Math.floor((parseDateOnly(to).getTime() - parseDateOnly(from).getTime()) / 86_400_000)
  )
}

function sum(values: number[]) {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}
