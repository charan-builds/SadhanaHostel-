import type { Tables } from "@/types/database"
import type { ResidentPaymentLedger } from "@/types/payment-operations"

type ResidentRow = Tables<"residents">
type PaymentRow = Tables<"payments">
type FeeRecordRow = Tables<"monthly_fee_records">
type InvoiceRow = Tables<"invoices">

export type CollectionPriority = "critical" | "high" | "medium" | "low" | "settled"

export type ResidentFinanceIntelligence = {
  resident: ResidentRow
  ledger: ResidentPaymentLedger
  monthlyFee: number
  currentDue: number
  overdueAmount: number
  advanceBalance: number
  lastPaymentDate: string | null
  lastPaymentAmount: number
  averageDelayDays: number
  onTimeRate: number
  latePayments: number
  partialPayments: number
  failedPayments: number
  collectionScore: number
  riskScore: number
  priority: CollectionPriority
  daysOverdue: number
}

export type ResidentFinanceSummary = Omit<ResidentFinanceIntelligence, "ledger"> & {
  hasVerifiedPaymentThisMonth: boolean
  primaryDueRecordId: string | null
  primaryDueBalance: number
  primaryDueDate: string | null
  nextDueDate: string | null
  invoiceNumbers: string[]
  receiptNumbers: string[]
  transactionIds: string[]
  searchIndex: string
}

export type AgingBucketKey = "current" | "1-7" | "8-15" | "16-30" | "30+"

export type AgingBucket = {
  key: AgingBucketKey
  label: string
  count: number
  amount: number
}

export type FinanceTimelineEvent = {
  id: string
  residentId: string
  residentName: string
  title: string
  description: string
  occurredAt: string
  amount?: number
  kind:
    | "payment_received"
    | "cash_collected"
    | "invoice_generated"
    | "receipt_generated"
    | "followup_scheduled"
    | "followup_completed"
    | "reminder_sent"
    | "due_generated"
    | "due_completed"
  tone: "success" | "warning" | "danger" | "info" | "neutral"
}

export type FinanceDueWindows = {
  today: number
  todayCount: number
  week: number
  weekCount: number
  month: number
  monthCount: number
}

export type FinanceOwnerAnalytics = {
  summary: {
    revenue: number
    todayRevenue: number
    billed: number
    pendingDues: number
    overdueDues: number
    unpaidResidents: number
    totalResidents: number
    activeResidents: number
    billingResidents: number
    paymentConversion: number
  }
  collectionToday: {
    cash: number
    upi: number
    bank: number
    total: number
  }
  upcomingDues: {
    next7Days: number
    next15Days: number
    next30Days: number
  }
  highRisk: {
    overdue30Plus: number
    overdue60Plus: number
    overdue90Plus: number
  }
  trends: Array<{
    month: string
    revenue: number
    billed: number
    dues: number
    paymentConversion: number
  }>
  forecasts: {
    revenue: {
      nextMonthExpectedBilling: number
      expectedCollectionRate: number
      expectedCollectedRevenue: number
      riskAdjustedPendingDues: number
    }
  }
  insights: Array<{
    severity: "critical" | "warning" | "info" | "success"
    title: string
    description: string
    action: string
  }>
}

export type FinanceDashboardQueryPlan = {
  bulkQueries: number
  residentRows: number
  beforeResidentLedgerRequests: number
  afterResidentLedgerRequests: 0
  residentLedgerRequests: 0
  truncated: boolean
  totalRowsScanned: number
}

export type FinanceDashboardDatabaseAggregates = {
  kpis: {
    expectedCollection: number
    collectedAmount: number
    pendingAmount: number
    activeResidents: number
    residentsWithPending: number
    overdueAmount: number
    advanceBalance: number
  }
  agingBuckets: AgingBucket[]
  metadata: {
    truncated: boolean
    totalRowsScanned: number
  }
}

export type FinanceDashboard = {
  generatedAt: string
  kpis: {
    expectedCollection: number
    collectedAmount: number
    pendingAmount: number
    collectionRate: number
    activeResidents: number
    residentsWithPending: number
    overdueAmount: number
    advanceBalance: number
    collectionEfficiency: number
    averageCollectionDelay: number
    residentsDueToday: number
  }
  summaries: ReturnType<typeof summarizeFinanceRows>
  dueWindows: FinanceDueWindows
  agingBuckets: AgingBucket[]
  attention: Record<"critical" | "high" | "medium" | "low", ResidentFinanceSummary[]>
  residentFinance: ResidentFinanceSummary[]
  recentPayments: PaymentRow[]
  timeline: FinanceTimelineEvent[]
  owner: FinanceOwnerAnalytics
  aggregation: FinanceDashboardDatabaseAggregates["metadata"] & {
    source: "database" | "snapshot"
  }
  queryPlan: FinanceDashboardQueryPlan
}

export function buildResidentFinanceIntelligence(input: {
  residents: ResidentRow[]
  ledgers: Array<ResidentPaymentLedger | undefined>
  today?: string
}): ResidentFinanceIntelligence[] {
  const today = input.today ?? dateOnly(new Date())

  return input.residents
    .map((resident, index) => {
      const ledger = input.ledgers[index]

      if (!ledger) {
        return null
      }

      return buildResidentFinanceRow(resident, ledger, today)
    })
    .filter((row): row is ResidentFinanceIntelligence => Boolean(row))
}

export function toResidentFinanceSummary(
  row: ResidentFinanceIntelligence,
  today = dateOnly(new Date())
): ResidentFinanceSummary {
  const { ledger, ...summary } = row
  const invoiceNumbers = ledger.invoices.map((invoice) => invoice.invoice_number)
  const receiptNumbers = ledger.invoices
    .filter((invoice) => invoice.status === "paid" || invoice.paid_amount > 0)
    .map((invoice) => invoice.invoice_number)
  const transactionIds = ledger.payments
    .flatMap((payment) => [payment.transaction_id, payment.manual_reference])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  const searchIndex = [
    row.resident.full_name,
    row.resident.admission_number,
    row.resident.phone,
    row.resident.email,
    ...invoiceNumbers,
    ...receiptNumbers,
    ...transactionIds,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return {
    ...summary,
    hasVerifiedPaymentThisMonth: ledger.payments.some(
      (payment) =>
        payment.status === "verified" &&
        payment.verified_at !== null &&
        payment.verified_at.slice(0, 7) === today.slice(0, 7)
    ),
    primaryDueRecordId: ledger.primaryDueRecord?.id ?? null,
    primaryDueBalance: ledger.primaryDueRecord?.balance_amount ?? 0,
    primaryDueDate: ledger.primaryDueRecord?.due_date ?? null,
    nextDueDate: ledger.billing.nextDueDate,
    invoiceNumbers,
    receiptNumbers,
    transactionIds,
    searchIndex,
  }
}

export function buildResidentFinanceRow(
  resident: ResidentRow,
  ledger: ResidentPaymentLedger,
  today = dateOnly(new Date())
): ResidentFinanceIntelligence {
  const payments = ledger.payments
  const feeRecords = ledger.feeRecords
  const failedPayments = payments.filter((payment) => payment.status === "failed").length
  const verifiedPayments = payments.filter(
    (payment) => payment.status === "verified" && !payment.is_advance
  )
  const lastPayment = [...verifiedPayments].sort(comparePaymentDateDesc)[0] ?? null
  const delayStats = calculateDelayStats(verifiedPayments, feeRecords)
  const daysOverdue = getMaxDaysOverdue(feeRecords, today)
  const currentDue = ledger.totals.currentDue
  const overdueAmount = sumOverdueAmount(feeRecords, today)
  const partialPayments =
    payments.filter((payment) => payment.is_partial).length +
    feeRecords.filter((record) => record.status === "partial").length

  const scorePenalty =
    delayStats.averageDelayDays * 3 +
    daysOverdue * 1.6 +
    partialPayments * 7 +
    failedPayments * 8
  const historyBonus =
    verifiedPayments.length > 0 ? Math.min(18, verifiedPayments.length * 3) : 0
  const onTimeBonus = delayStats.onTimeRate * 0.28
  const collectionScore = clampScore(72 + historyBonus + onTimeBonus - scorePenalty)
  const riskScore = clampScore(
    100 -
      collectionScore +
      (currentDue > 0 ? 10 : 0) +
      Math.min(28, daysOverdue * 1.15) +
      failedPayments * 5
  )

  return {
    resident,
    ledger,
    monthlyFee: resident.monthly_fee_amount,
    currentDue,
    overdueAmount,
    advanceBalance: ledger.totals.advanceBalance,
    lastPaymentDate: lastPayment ? paymentDate(lastPayment) : null,
    lastPaymentAmount: lastPayment?.amount ?? 0,
    averageDelayDays: delayStats.averageDelayDays,
    onTimeRate: delayStats.onTimeRate,
    latePayments: delayStats.latePayments,
    partialPayments,
    failedPayments,
    collectionScore,
    riskScore,
    priority: getCollectionPriority(currentDue, daysOverdue),
    daysOverdue,
  }
}

export function buildAgingBuckets(
  ledgers: Array<ResidentPaymentLedger | undefined>,
  today = dateOnly(new Date())
): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { key: "current", label: "Current", count: 0, amount: 0 },
    { key: "1-7", label: "1-7 Days", count: 0, amount: 0 },
    { key: "8-15", label: "8-15 Days", count: 0, amount: 0 },
    { key: "16-30", label: "16-30 Days", count: 0, amount: 0 },
    { key: "30+", label: "30+ Days", count: 0, amount: 0 },
  ]
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const ledger of ledgers) {
    if (!ledger) {
      continue
    }

    for (const record of ledger.feeRecords) {
      if (!isDueRecord(record)) {
        continue
      }

      const days = daysOverdue(record.due_date, today)
      const key = agingKey(days)
      const bucket = byKey.get(key)

      if (bucket) {
        bucket.count += 1
        bucket.amount += record.balance_amount
      }
    }
  }

  return buckets
}

export function groupAttentionQueue(rows: ResidentFinanceIntelligence[]) {
  return {
    critical: rows
      .filter((row) => row.priority === "critical")
      .sort(compareCollectionPriority),
    high: rows
      .filter((row) => row.priority === "high")
      .sort(compareCollectionPriority),
    medium: rows
      .filter((row) => row.priority === "medium")
      .sort(compareCollectionPriority),
    low: rows
      .filter((row) => row.priority === "low")
      .sort(compareCollectionPriority),
  }
}

export function buildFinanceTimeline(
  ledgers: Array<ResidentPaymentLedger | undefined>,
  limit = 18
): FinanceTimelineEvent[] {
  const events: FinanceTimelineEvent[] = []

  for (const ledger of ledgers) {
    if (!ledger) {
      continue
    }

    const residentName = ledger.resident.full_name
    const residentId = ledger.resident.id

    for (const record of ledger.feeRecords) {
      events.push(feeGeneratedEvent(record, residentId, residentName))

      if (record.status === "paid") {
        events.push({
          id: `fee-paid:${record.id}`,
          residentId,
          residentName,
          title: "Due completed",
          description: `${monthLabel(record.period_month)} dues completed.`,
          occurredAt: record.updated_at,
          amount: record.total_amount,
          kind: "due_completed",
          tone: "success",
        })
      }
    }

    for (const invoice of ledger.invoices) {
      events.push(invoiceEvent(invoice, residentId, residentName))
    }

    for (const payment of ledger.payments) {
      events.push(paymentEvent(payment, residentId, residentName))
    }
  }

  return events
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit)
}

export function buildDueWindows(
  rows: ResidentFinanceIntelligence[],
  today = dateOnly(new Date())
): FinanceDueWindows {
  const todayTime = new Date(`${today}T00:00:00.000Z`).getTime()
  const weekEnd = todayTime + 7 * 86_400_000
  const month = today.slice(0, 7)
  const windows: FinanceDueWindows = {
    today: 0,
    todayCount: 0,
    week: 0,
    weekCount: 0,
    month: 0,
    monthCount: 0,
  }

  for (const row of rows) {
    for (const fee of row.ledger.feeRecords) {
      if (!isDueRecord(fee)) {
        continue
      }

      const dueTime = new Date(`${fee.due_date}T00:00:00.000Z`).getTime()

      if (fee.due_date === today) {
        windows.today += fee.balance_amount
        windows.todayCount += 1
      }

      if (dueTime >= todayTime && dueTime <= weekEnd) {
        windows.week += fee.balance_amount
        windows.weekCount += 1
      }

      if (fee.due_date.startsWith(month)) {
        windows.month += fee.balance_amount
        windows.monthCount += 1
      }
    }
  }

  return windows
}

export function summarizeFinanceRows(
  rows: ResidentFinanceIntelligence[],
  today = dateOnly(new Date())
) {
  const currentMonth = today.slice(0, 7)

  return {
    totalExpected: rows.reduce((total, row) => total + currentMonthExpected(row, currentMonth), 0),
    totalPending: rows.reduce((total, row) => total + row.currentDue, 0),
    totalOverdue: rows.reduce((total, row) => total + row.overdueAmount, 0),
    totalAdvance: rows.reduce((total, row) => total + row.advanceBalance, 0),
    residentsWithPending: rows.filter((row) => row.currentDue > 0).length,
    highRiskResidents: rows.filter((row) => row.riskScore >= 70).length,
  }
}

function currentMonthExpected(row: ResidentFinanceIntelligence, currentMonth: string) {
  return row.ledger.feeRecords.reduce((total, record) => {
    if (
      record.deleted_at !== null ||
      !record.period_month.startsWith(currentMonth) ||
      record.status === "cancelled"
    ) {
      return total
    }

    return total + record.total_amount
  }, 0)
}

function calculateDelayStats(
  verifiedPayments: PaymentRow[],
  feeRecords: FeeRecordRow[]
) {
  const feeRecordById = new Map(feeRecords.map((record) => [record.id, record]))
  const delays = verifiedPayments
    .map((payment) => {
      if (!payment.monthly_fee_record_id) {
        return null
      }

      const feeRecord = feeRecordById.get(payment.monthly_fee_record_id)

      if (!feeRecord) {
        return null
      }

      return Math.max(0, diffDays(feeRecord.due_date, paymentDate(payment)))
    })
    .filter((delay): delay is number => typeof delay === "number")

  if (delays.length === 0) {
    return {
      averageDelayDays: 0,
      onTimeRate: verifiedPayments.length > 0 ? 100 : 0,
      latePayments: 0,
    }
  }

  const latePayments = delays.filter((delay) => delay > 0).length

  return {
    averageDelayDays: Math.round(
      delays.reduce((total, delay) => total + delay, 0) / delays.length
    ),
    onTimeRate: Math.round(((delays.length - latePayments) / delays.length) * 100),
    latePayments,
  }
}

function getCollectionPriority(
  currentDue: number,
  daysOverdueValue: number
): CollectionPriority {
  if (currentDue <= 0) {
    return "settled"
  }

  if (daysOverdueValue > 30) {
    return "critical"
  }

  if (daysOverdueValue > 15) {
    return "high"
  }

  if (daysOverdueValue > 7) {
    return "medium"
  }

  return "low"
}

function compareCollectionPriority(
  first: ResidentFinanceIntelligence,
  second: ResidentFinanceIntelligence
) {
  return (
    second.daysOverdue - first.daysOverdue ||
    second.currentDue - first.currentDue ||
    second.riskScore - first.riskScore
  )
}

function getMaxDaysOverdue(feeRecords: FeeRecordRow[], today: string) {
  return feeRecords.reduce((max, record) => {
    if (!isDueRecord(record)) {
      return max
    }

    return Math.max(max, daysOverdue(record.due_date, today))
  }, 0)
}

function sumOverdueAmount(feeRecords: FeeRecordRow[], today: string) {
  return feeRecords.reduce((total, record) => {
    if (!isDueRecord(record) || daysOverdue(record.due_date, today) <= 0) {
      return total
    }

    return total + record.balance_amount
  }, 0)
}

function isDueRecord(record: FeeRecordRow) {
  return (
    record.deleted_at === null &&
    record.balance_amount > 0 &&
    ["pending", "partial", "overdue"].includes(record.status)
  )
}

function agingKey(days: number): AgingBucketKey {
  if (days <= 0) {
    return "current"
  }

  if (days <= 7) {
    return "1-7"
  }

  if (days <= 15) {
    return "8-15"
  }

  if (days <= 30) {
    return "16-30"
  }

  return "30+"
}

function daysOverdue(dueDate: string, today: string) {
  return Math.max(0, diffDays(dueDate, today))
}

function diffDays(fromDate: string, toDate: string) {
  const from = parseDateOnly(fromDate).getTime()
  const to = parseDateOnly(toDate).getTime()

  return Math.floor((to - from) / 86_400_000)
}

function parseDateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function paymentDate(payment: PaymentRow) {
  return (
    payment.verified_at ??
    payment.paid_at ??
    payment.created_at
  )
}

function comparePaymentDateDesc(first: PaymentRow, second: PaymentRow) {
  return new Date(paymentDate(second)).getTime() - new Date(paymentDate(first)).getTime()
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`))
}

function feeGeneratedEvent(
  record: FeeRecordRow,
  residentId: string,
  residentName: string
): FinanceTimelineEvent {
  return {
    id: `fee:${record.id}`,
    residentId,
    residentName,
    title: "Fee generated",
    description: `${monthLabel(record.period_month)} fee generated.`,
    occurredAt: record.generated_at ?? record.created_at,
    amount: record.total_amount,
    kind: "due_generated",
    tone: record.balance_amount > 0 ? "warning" : "info",
  }
}

function invoiceEvent(
  invoice: InvoiceRow,
  residentId: string,
  residentName: string
): FinanceTimelineEvent {
  return {
    id: `invoice:${invoice.id}`,
    residentId,
    residentName,
    title: invoice.status === "paid" ? "Receipt generated" : "Invoice generated",
    description: invoice.invoice_number,
    occurredAt: invoice.created_at,
    amount: invoice.total_amount,
    kind: invoice.status === "paid" ? "receipt_generated" : "invoice_generated",
    tone: invoice.status === "paid" ? "success" : "info",
  }
}

function paymentEvent(
  payment: PaymentRow,
  residentId: string,
  residentName: string
): FinanceTimelineEvent {
  const verified = payment.status === "verified"

  return {
    id: `payment:${payment.id}`,
    residentId,
    residentName,
    title: payment.is_advance
      ? "Advance received"
      : verified && payment.method === "cash"
        ? "Cash collected"
        : verified
          ? "Payment received"
        : "Payment recorded",
    description: payment.manual_reference ?? payment.transaction_id ?? payment.method,
    occurredAt: paymentDate(payment),
    amount: payment.amount,
    kind: verified && payment.method === "cash" ? "cash_collected" : "payment_received",
    tone: verified ? "success" : payment.status === "failed" ? "danger" : "warning",
  }
}
