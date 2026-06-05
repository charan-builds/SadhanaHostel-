import type {
  FinanceDashboard,
  ResidentFinanceSummary,
} from "@/lib/finance/finance-dashboard"

export type CollectionSectionKey =
  | "dueToday"
  | "dueThisWeek"
  | "overdue"
  | "upcomingDues"
  | "highRisk"

export type CollectionDrawerTab = "ledger" | "invoices" | "receipts" | "payments"
export type CollectionPaymentMethod = "cash" | "upi" | "bank_transfer"

export type CollectionSection = {
  key: CollectionSectionKey
  title: string
  rows: ResidentFinanceSummary[]
}

export type CollectionKpis = {
  todayCollection: number
  monthCollection: number
  pendingCollection: number
  overdueCollection: number
  dueToday: number
  dueThisWeek: number
  collectionRate: number
  averageCollectionDelay: number
  residentsDueToday: number
}

export function buildCollectionKpis(dashboard: FinanceDashboard): CollectionKpis {
  return {
    todayCollection: dashboard.owner.summary.todayRevenue,
    monthCollection: dashboard.kpis.collectedAmount,
    pendingCollection: dashboard.kpis.pendingAmount,
    overdueCollection: dashboard.kpis.overdueAmount,
    dueToday: dashboard.dueWindows.today,
    dueThisWeek: Math.max(0, dashboard.dueWindows.week - dashboard.dueWindows.today),
    collectionRate: dashboard.kpis.collectionRate,
    averageCollectionDelay: dashboard.kpis.averageCollectionDelay,
    residentsDueToday: dashboard.kpis.residentsDueToday,
  }
}

export function buildCollectionSections(
  rows: ResidentFinanceSummary[],
  today: string
): CollectionSection[] {
  return [
    {
      key: "dueToday",
      title: "Due Today",
      rows: rows.filter((row) => row.primaryDueDate === today),
    },
    {
      key: "overdue",
      title: "Overdue",
      rows: rows.filter((row) => row.overdueAmount > 0),
    },
    {
      key: "dueThisWeek",
      title: "Due This Week",
      rows: rows.filter((row) => isDueWithinDays(row, today, 7)),
    },
    {
      key: "upcomingDues",
      title: "Upcoming Dues",
      rows: rows.filter((row) => isUpcomingDue(row, today)),
    },
    {
      key: "highRisk",
      title: "High Risk Residents",
      rows: rows.filter(
        (row) => row.priority === "critical" || row.priority === "high" || row.riskScore >= 70
      ),
    },
  ]
}

export function filterCollectionRows(
  rows: ResidentFinanceSummary[],
  search: string
): ResidentFinanceSummary[] {
  const query = normalizeSearch(search)

  if (!query) {
    return rows
  }

  return rows.filter((row) => row.searchIndex.includes(query))
}

function isUpcomingDue(row: ResidentFinanceSummary, today: string) {
  const dueDate = row.primaryDueDate ?? row.nextDueDate

  if (!dueDate || dueDate <= today) {
    return false
  }

  return diffDays(today, dueDate) <= 30
}

function isDueWithinDays(row: ResidentFinanceSummary, today: string, days: number) {
  const dueDate = row.primaryDueDate ?? row.nextDueDate

  if (!dueDate) {
    return false
  }

  const diff = diffDays(today, dueDate)

  return diff > 0 && diff <= days
}

function normalizeSearch(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function diffDays(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate.slice(0, 10)}T00:00:00.000Z`)
  const to = Date.parse(`${toDate.slice(0, 10)}T00:00:00.000Z`)

  return Math.floor((to - from) / 86_400_000)
}
