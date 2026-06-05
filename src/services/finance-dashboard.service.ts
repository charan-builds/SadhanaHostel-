import "server-only"

import {
  buildAgingBuckets,
  buildDueWindows,
  buildFinanceTimeline,
  buildResidentFinanceRow,
  groupAttentionQueue,
  summarizeFinanceRows,
  toResidentFinanceSummary,
  type FinanceDashboard,
  type FinanceDashboardDatabaseAggregates,
  type FinanceOwnerAnalytics,
  type FinanceTimelineEvent,
} from "@/lib/finance/finance-dashboard"
import {
  buildResidentBillingContext,
  parseDateOnly,
  resolveNextBillingDueDate,
  todayDateOnly,
  toPeriodMonth,
} from "@/lib/finance/billing-date"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CollectionFollowupsRepository,
  type CollectionFollowupRow,
} from "@/repositories/collection-followups.repository"
import { throwRepositoryError, type AppSupabaseClient } from "@/repositories/types"
import { isResidentEligibleForAnalytics, isResidentEligibleForBilling } from "@/services/analytics/operational-metrics"
import type { Tables } from "@/types/database"
import type { ResidentPaymentLedger } from "@/types/payment-operations"
import { financeDashboardSchema } from "@/validations/finance.validation"

import { AuthService } from "./auth.service"

const DASHBOARD_BULK_QUERY_COUNT = 6

type ResidentRow = Tables<"residents">
type FeeRecordRow = Tables<"monthly_fee_records">
type PaymentRow = Tables<"payments">
type InvoiceRow = Tables<"invoices">
type FinanceDashboardRpcClient = {
  rpc(
    name: "finance_dashboard_aggregates",
    args: {
      p_organization_id: string
      p_hostel_id: string | null
      p_today: string
    }
  ): Promise<{ data: unknown; error: { message: string; code?: string } | null }>
}

export class FinanceDashboardService {
  private readonly authService: AuthService
  private readonly followupsRepository: CollectionFollowupsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.followupsRepository = new CollectionFollowupsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new FinanceDashboardService(db)
  }

  async getDashboard(input: unknown): Promise<FinanceDashboard> {
    const values = financeDashboardSchema.parse(input)
    const context = await this.authService.requirePermission("finance.manage")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const today = todayDateOnly()
    const [databaseAggregates, residents, feeRecords, payments, invoices, followups] = await Promise.all([
      this.loadDatabaseAggregates(values.organizationId, hostelId ?? null, today),
      this.listResidents(values.organizationId, hostelId ?? undefined),
      this.listFeeRecords(values.organizationId, hostelId ?? undefined),
      this.listPayments(values.organizationId, hostelId ?? undefined),
      this.listInvoices(values.organizationId, hostelId ?? undefined),
      this.followupsRepository.list({
        organizationId: values.organizationId,
        hostelId,
        limit: 25,
      }),
    ])

    return buildFinanceDashboardSnapshot({
      organizationId: values.organizationId,
      hostelId: hostelId ?? undefined,
      residents,
      feeRecords,
      payments,
      invoices,
      followups,
      databaseAggregates,
      today,
    })
  }

  private async loadDatabaseAggregates(
    organizationId: string,
    hostelId: string | null,
    today: string
  ): Promise<FinanceDashboardDatabaseAggregates> {
    const { data, error } = await (this.db as unknown as FinanceDashboardRpcClient).rpc(
      "finance_dashboard_aggregates",
      {
        p_organization_id: organizationId,
        p_hostel_id: hostelId,
        p_today: today,
      }
    )

    if (error) {
      throwRepositoryError(error as never, "Unable to load finance dashboard aggregates.")
    }

    return normalizeDatabaseAggregates(data)
  }

  private async listResidents(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("residents")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load finance residents.")
    }

    return data ?? []
  }

  private async listFeeRecords(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("monthly_fee_records")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("due_date", { ascending: false })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load finance fee records.")
    }

    return data ?? []
  }

  private async listPayments(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load finance payments.")
    }

    return data ?? []
  }

  private async listInvoices(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load finance invoices.")
    }

    return data ?? []
  }
}

export function buildFinanceDashboardSnapshot(input: {
  organizationId: string
  hostelId?: string
  residents: ResidentRow[]
  feeRecords: FeeRecordRow[]
  payments: PaymentRow[]
  invoices: InvoiceRow[]
  followups?: CollectionFollowupRow[]
  databaseAggregates?: FinanceDashboardDatabaseAggregates
  today?: string
  generatedAt?: string
}): FinanceDashboard {
  const today = input.today ?? todayDateOnly()
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const ledgers = buildBulkLedgers({
    residents: input.residents,
    feeRecords: input.feeRecords,
    payments: input.payments,
    invoices: input.invoices,
    today,
  })
  const financeRows = input.residents.map((resident, index) =>
    buildResidentFinanceRow(resident, ledgers[index], today)
  )
  const summaries = summarizeFinanceRows(financeRows, today)
  const residentFinance = financeRows
    .map((row) => toResidentFinanceSummary(row, today))
    .sort(compareDashboardRows)
  const attentionRows = groupAttentionQueue(financeRows)
  const attention = {
    critical: attentionRows.critical.map((row) => toResidentFinanceSummary(row, today)),
    high: attentionRows.high.map((row) => toResidentFinanceSummary(row, today)),
    medium: attentionRows.medium.map((row) => toResidentFinanceSummary(row, today)),
    low: attentionRows.low.map((row) => toResidentFinanceSummary(row, today)),
  }
  const owner = buildFinanceOwnerAnalytics({
    residents: input.residents,
    feeRecords: input.feeRecords,
    payments: input.payments,
    summaries,
    today,
  })
  const collectedAmount = owner.summary.revenue
  const expectedCollection = summaries.totalExpected
  const aggregateKpis = input.databaseAggregates?.kpis
  const aggregateMetadata = input.databaseAggregates?.metadata ?? {
    truncated: false,
    totalRowsScanned:
      input.residents.length + input.feeRecords.length + input.payments.length + input.invoices.length,
  }
  const resolvedExpectedCollection = aggregateKpis?.expectedCollection ?? expectedCollection
  const resolvedCollectedAmount = aggregateKpis?.collectedAmount ?? collectedAmount
  const collectionRate = percent(resolvedCollectedAmount, resolvedExpectedCollection)
  const collectionEfficiency = average(financeRows.map((row) => row.collectionScore))
  const averageCollectionDelay = average(financeRows.map((row) => row.averageDelayDays))
  const dueWindows = buildDueWindows(financeRows, today)

  return {
    generatedAt,
    kpis: {
      expectedCollection: resolvedExpectedCollection,
      collectedAmount: resolvedCollectedAmount,
      pendingAmount: aggregateKpis?.pendingAmount ?? summaries.totalPending,
      collectionRate,
      activeResidents: aggregateKpis?.activeResidents ?? owner.summary.activeResidents,
      residentsWithPending: aggregateKpis?.residentsWithPending ?? summaries.residentsWithPending,
      overdueAmount: aggregateKpis?.overdueAmount ?? summaries.totalOverdue,
      advanceBalance: aggregateKpis?.advanceBalance ?? summaries.totalAdvance,
      collectionEfficiency,
      averageCollectionDelay,
      residentsDueToday: dueWindows.todayCount,
    },
    summaries,
    dueWindows,
    agingBuckets: input.databaseAggregates?.agingBuckets ?? buildAgingBuckets(ledgers, today),
    attention,
    residentFinance,
    recentPayments: recentVerifiedPayments(input.payments).slice(0, 50),
    timeline: mergeTimelineEvents(
      buildFinanceTimeline(ledgers, 20),
      buildFollowupTimeline(input.followups ?? [], input.residents),
      20
    ),
    owner,
    aggregation: {
      source: input.databaseAggregates ? "database" : "snapshot",
      truncated: aggregateMetadata.truncated,
      totalRowsScanned: aggregateMetadata.totalRowsScanned,
    },
    queryPlan: {
      bulkQueries: DASHBOARD_BULK_QUERY_COUNT,
      residentRows: input.residents.length,
      beforeResidentLedgerRequests: input.residents.length,
      afterResidentLedgerRequests: 0,
      residentLedgerRequests: 0,
      truncated: aggregateMetadata.truncated,
      totalRowsScanned: aggregateMetadata.totalRowsScanned,
    },
  }
}

function normalizeDatabaseAggregates(data: unknown): FinanceDashboardDatabaseAggregates {
  const record = toRecord(data)
  const kpis = toRecord(record.kpis)
  const metadata = toRecord(record.metadata)
  const agingBuckets = Array.isArray(record.agingBuckets) ? record.agingBuckets : []

  return {
    kpis: {
      expectedCollection: numberValue(kpis.expectedCollection),
      collectedAmount: numberValue(kpis.collectedAmount),
      pendingAmount: numberValue(kpis.pendingAmount),
      activeResidents: numberValue(kpis.activeResidents),
      residentsWithPending: numberValue(kpis.residentsWithPending),
      overdueAmount: numberValue(kpis.overdueAmount),
      advanceBalance: numberValue(kpis.advanceBalance),
    },
    agingBuckets: agingBuckets.map((bucket) => {
      const row = toRecord(bucket)

      return {
        key: String(row.key) as FinanceDashboardDatabaseAggregates["agingBuckets"][number]["key"],
        label: String(row.label ?? row.key ?? ""),
        count: numberValue(row.count),
        amount: numberValue(row.amount),
      }
    }),
    metadata: {
      truncated: Boolean(metadata.truncated),
      totalRowsScanned: numberValue(metadata.totalRowsScanned),
    },
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0)

  return Number.isFinite(number) ? number : 0
}

function buildBulkLedgers(input: {
  residents: ResidentRow[]
  feeRecords: FeeRecordRow[]
  payments: PaymentRow[]
  invoices: InvoiceRow[]
  today: string
}) {
  const feeRecordsByResident = groupByResident(input.feeRecords)
  const paymentsByResident = groupByResident(input.payments)
  const invoicesByResident = groupByResident(input.invoices)

  return input.residents.map((resident) => {
    const feeRecords = feeRecordsByResident.get(resident.id) ?? []
    const payments = paymentsByResident.get(resident.id) ?? []
    const invoices = invoicesByResident.get(resident.id) ?? []
    const unpaidFeeRecords = feeRecords
      .filter(isOpenDueRecord)
      .toSorted(compareFeeRecordsByDueDate)
    const billing = buildResidentBillingContext({
      joinedOn: resident.joined_on,
      today: input.today,
    })

    return {
      resident: {
        id: resident.id,
        full_name: resident.full_name,
        hostel_id: resident.hostel_id,
        monthly_fee_amount: resident.monthly_fee_amount,
        joined_on: resident.joined_on,
      },
      totals: {
        currentDue: sum(unpaidFeeRecords.map((record) => record.balance_amount)),
        overdue: sum(
          unpaidFeeRecords
            .filter((record) => record.due_date < input.today)
            .map((record) => record.balance_amount)
        ),
        pendingVerification: sum(
          payments
            .filter((payment) => payment.status === "pending" || payment.status === "initiated")
            .map((payment) => payment.amount)
        ),
        verifiedPaid: sum(
          payments
            .filter((payment) => payment.status === "verified")
            .map((payment) => payment.amount)
        ),
        advanceBalance: sum(
          payments
            .filter((payment) => payment.status === "verified" && payment.is_advance)
            .map((payment) => payment.amount)
        ),
      },
      billing: {
        joinedOn: resident.joined_on,
        currentPeriodMonth: billing.currentPeriodMonth,
        currentDueDate: billing.currentDueDate,
        nextDueDate: resolveNextBillingDueDate({ billing, today: input.today }),
        generatedCurrentDue: false,
      },
      primaryDueRecord: unpaidFeeRecords[0] ?? null,
      feeRecords,
      payments,
      invoices,
    } satisfies ResidentPaymentLedger
  })
}

function buildFinanceOwnerAnalytics(input: {
  residents: ResidentRow[]
  feeRecords: FeeRecordRow[]
  payments: PaymentRow[]
  summaries: ReturnType<typeof summarizeFinanceRows>
  today: string
}): FinanceOwnerAnalytics {
  const monthKeys = buildRecentMonthKeys(input.today, 6)
  const billingResidentIds = new Set(
    input.residents
      .filter(isResidentEligibleForBilling)
      .map((resident) => resident.id)
  )
  const billingFeeRecords = input.feeRecords.filter((record) =>
    billingResidentIds.has(record.resident_id)
  )
  const trends = monthKeys.map((month) => {
    const monthPayments = input.payments.filter(
      (payment) => payment.created_at.slice(0, 7) === month
    )
    const verifiedPayments = input.payments.filter(
      (payment) =>
        payment.status === "verified" &&
        payment.verified_at !== null &&
        payment.verified_at.slice(0, 7) === month
    )
    const feeRecords = billingFeeRecords.filter(
      (record) => record.period_month.slice(0, 7) === month
    )

    return {
      month,
      revenue: sum(verifiedPayments.map((payment) => payment.amount)),
      billed: sum(feeRecords.map((record) => record.total_amount)),
      dues: sum(feeRecords.map((record) => record.balance_amount)),
      paymentConversion: percent(verifiedPayments.length, monthPayments.length),
    }
  })
  const currentMonth = input.today.slice(0, 7)
  const currentMonthPayments = input.payments.filter(
    (payment) => payment.created_at.slice(0, 7) === currentMonth
  )
  const currentMonthVerifiedPayments = input.payments.filter(
    (payment) =>
      payment.status === "verified" &&
      payment.verified_at !== null &&
      payment.verified_at.slice(0, 7) === currentMonth
  )
  const recentTrends = trends.slice(-3)
  const averageBilled = average(recentTrends.map((trend) => trend.billed))
  const averageRevenue = average(recentTrends.map((trend) => trend.revenue))
  const expectedCollectionRate = percent(averageRevenue, averageBilled)

  return {
    summary: {
      revenue: sum(currentMonthVerifiedPayments.map((payment) => payment.amount)),
      todayRevenue: sum(
        input.payments
          .filter(
            (payment) =>
              payment.status === "verified" &&
              payment.verified_at !== null &&
              payment.verified_at.slice(0, 10) === input.today
          )
          .map((payment) => payment.amount)
      ),
      billed: input.summaries.totalExpected,
      pendingDues: input.summaries.totalPending,
      overdueDues: input.summaries.totalOverdue,
      unpaidResidents: input.summaries.residentsWithPending,
      totalResidents: input.residents.length,
      activeResidents: input.residents.filter(isResidentEligibleForAnalytics).length,
      billingResidents: billingResidentIds.size,
      paymentConversion: percent(currentMonthVerifiedPayments.length, currentMonthPayments.length),
    },
    collectionToday: buildTodayCollectionByMethod(input.payments, input.today),
    upcomingDues: buildUpcomingDues(input.feeRecords, input.today),
    highRisk: buildHighRiskDues(input.feeRecords, input.today),
    trends,
    forecasts: {
      revenue: {
        nextMonthExpectedBilling: Math.round(averageBilled),
        expectedCollectionRate,
        expectedCollectedRevenue: Math.round(averageRevenue),
        riskAdjustedPendingDues: input.summaries.totalOverdue,
      },
    },
    insights: buildOwnerInsights({
      pendingDues: input.summaries.totalPending,
      overdueAmount: input.summaries.totalOverdue,
      highRiskResidents: input.summaries.highRiskResidents,
      collectionRate: percent(
        sum(currentMonthVerifiedPayments.map((payment) => payment.amount)),
        input.summaries.totalExpected
      ),
    }),
  }
}

function buildOwnerInsights(input: {
  pendingDues: number
  overdueAmount: number
  highRiskResidents: number
  collectionRate: number
}): FinanceOwnerAnalytics["insights"] {
  const insights: FinanceOwnerAnalytics["insights"] = []

  if (input.overdueAmount > 0) {
    insights.push({
      severity: "critical",
      title: "Overdue collection risk",
      description: `Overdue balance is ${formatCurrency(input.overdueAmount)} across open dues.`,
      action: "Prioritize the critical and high-risk collection queues.",
    })
  }

  if (input.highRiskResidents > 0) {
    insights.push({
      severity: "warning",
      title: "High-risk residents need follow-up",
      description: `${input.highRiskResidents} residents have elevated collection risk.`,
      action: "Schedule follow-ups from the resident finance drawer.",
    })
  }

  insights.push({
    severity: input.collectionRate >= 85 ? "success" : "info",
    title: "Collection rate",
    description: `Current month collection rate is ${input.collectionRate}%.`,
    action: input.pendingDues > 0 ? "Continue daily collection review." : "Monitor upcoming dues.",
  })

  return insights
}

function recentVerifiedPayments(payments: PaymentRow[]) {
  return payments
    .filter((payment) => payment.status === "verified" && payment.verified_at !== null)
    .toSorted((left, right) => paymentDate(right).localeCompare(paymentDate(left)))
}

function buildFollowupTimeline(
  followups: CollectionFollowupRow[],
  residents: ResidentRow[]
): FinanceTimelineEvent[] {
  const namesByResidentId = new Map(
    residents.map((resident) => [resident.id, resident.full_name])
  )

  return followups.map((followup) => ({
    id: `followup-${followup.id}`,
    residentId: followup.resident_id,
    residentName: namesByResidentId.get(followup.resident_id) ?? "Resident",
    title:
      followup.status === "completed"
        ? "Follow-up completed"
        : followup.next_followup_at
          ? "Follow-up scheduled"
          : "Collection note added",
    description: followup.note,
    occurredAt: followup.completed_at ?? followup.created_at,
    kind: followup.status === "completed" ? "followup_completed" : "followup_scheduled",
    tone:
      followup.status === "completed"
        ? "success"
        : followup.priority === "critical" || followup.priority === "high"
          ? "warning"
          : "info",
  }))
}

function buildTodayCollectionByMethod(payments: PaymentRow[], today: string) {
  const verifiedToday = payments.filter(
    (payment) =>
      payment.status === "verified" &&
      payment.verified_at !== null &&
      payment.verified_at.slice(0, 10) === today
  )
  const cash = sum(
    verifiedToday.filter((payment) => payment.method === "cash").map((payment) => payment.amount)
  )
  const upi = sum(
    verifiedToday.filter((payment) => payment.method === "upi").map((payment) => payment.amount)
  )
  const bank = sum(
    verifiedToday
      .filter((payment) => payment.method === "bank_transfer")
      .map((payment) => payment.amount)
  )

  return {
    cash,
    upi,
    bank,
    total: cash + upi + bank,
  }
}

function buildUpcomingDues(feeRecords: FeeRecordRow[], today: string) {
  const todayTime = parseDateOnly(today).getTime()

  return {
    next7Days: sumDueWindow(feeRecords, todayTime, 7),
    next15Days: sumDueWindow(feeRecords, todayTime, 15),
    next30Days: sumDueWindow(feeRecords, todayTime, 30),
  }
}

function sumDueWindow(feeRecords: FeeRecordRow[], todayTime: number, days: number) {
  const until = todayTime + days * 86_400_000

  return sum(
    feeRecords
      .filter((record) => {
        if (!isOpenDueRecord(record)) {
          return false
        }

        const dueTime = parseDateOnly(record.due_date).getTime()

        return dueTime >= todayTime && dueTime <= until
      })
      .map((record) => record.balance_amount)
  )
}

function buildHighRiskDues(feeRecords: FeeRecordRow[], today: string) {
  return {
    overdue30Plus: countOverdueAtLeast(feeRecords, today, 30),
    overdue60Plus: countOverdueAtLeast(feeRecords, today, 60),
    overdue90Plus: countOverdueAtLeast(feeRecords, today, 90),
  }
}

function countOverdueAtLeast(feeRecords: FeeRecordRow[], today: string, days: number) {
  return new Set(
    feeRecords
      .filter(
        (record) =>
          isOpenDueRecord(record) &&
          Math.floor((parseDateOnly(today).getTime() - parseDateOnly(record.due_date).getTime()) / 86_400_000) >= days
      )
      .map((record) => record.resident_id)
  ).size
}

function mergeTimelineEvents(
  first: FinanceTimelineEvent[],
  second: FinanceTimelineEvent[],
  limit: number
) {
  return [...first, ...second]
    .toSorted((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, limit)
}

function groupByResident<T extends { resident_id: string }>(rows: T[]) {
  const byResident = new Map<string, T[]>()

  for (const row of rows) {
    const existing = byResident.get(row.resident_id) ?? []

    existing.push(row)
    byResident.set(row.resident_id, existing)
  }

  return byResident
}

function isOpenDueRecord(record: FeeRecordRow) {
  return (
    record.deleted_at === null &&
    record.balance_amount > 0 &&
    ["pending", "partial", "overdue"].includes(record.status)
  )
}

function compareFeeRecordsByDueDate(left: FeeRecordRow, right: FeeRecordRow) {
  return (
    left.due_date.localeCompare(right.due_date) ||
    left.period_month.localeCompare(right.period_month) ||
    left.created_at.localeCompare(right.created_at)
  )
}

function compareDashboardRows(
  left: ReturnType<typeof toResidentFinanceSummary>,
  right: ReturnType<typeof toResidentFinanceSummary>
) {
  return (
    right.daysOverdue - left.daysOverdue ||
    right.currentDue - left.currentDue ||
    right.riskScore - left.riskScore ||
    left.resident.full_name.localeCompare(right.resident.full_name)
  )
}

function buildRecentMonthKeys(today: string, count: number) {
  const current = parseDateOnly(`${today.slice(0, 7)}-01`)

  return Array.from({ length: count }, (_, index) => {
    const month = new Date(Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth() - (count - 1 - index),
      1
    ))

    return toPeriodMonth(month).slice(0, 7)
  })
}

function paymentDate(payment: PaymentRow) {
  return payment.verified_at ?? payment.paid_at ?? payment.created_at
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return Math.round(sum(values) / values.length)
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return Number(((value / total) * 100).toFixed(2))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}
