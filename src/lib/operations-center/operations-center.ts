import type { FinanceDashboard } from "@/lib/finance/finance-dashboard"
import type { DashboardAnalytics, OwnerAnalytics } from "@/sdk"
import type { VacancyPayload } from "@/sdk/admissions.sdk"
import type { LeadRow, ReservationRow } from "@/types/admissions"
import type { Tables } from "@/types/database"
import type { NoticeWithEngagement } from "@/types/notices"
import type { ResidentWithOnboarding } from "@/repositories/residents.repository"

export type OperationsPriority = "critical" | "high" | "medium" | "low"

export type OperationsQueueSource =
  | "admission"
  | "payment"
  | "complaint"
  | "leave"
  | "onboarding"
  | "notice"

export type OperationsQueueAction =
  | "verify_payment"
  | "approve_leave"
  | "resolve_complaint"
  | "send_reminder"
  | "publish_notice"
  | "review"

export type OperationsQueueItem = {
  id: string
  title: string
  detail: string
  source: OperationsQueueSource
  priority: OperationsPriority
  href: string
  createdAt: string
  action: OperationsQueueAction
}

export type OperationsHealthWidget = {
  id: "revenue" | "occupancy" | "complaints" | "communication"
  title: string
  value: string
  detail: string
  priority: OperationsPriority
  href: string
}

export type OperationsCenterModel = {
  queue: OperationsQueueItem[]
  queueByPriority: Record<OperationsPriority, OperationsQueueItem[]>
  health: OperationsHealthWidget[]
  summary: string
  counts: {
    pendingAdmissions: number
    pendingPayments: number
    pendingComplaints: number
    pendingLeaves: number
    onboardingTasks: number
    noticeFollowups: number
  }
}

type BuildOperationsCenterInput = {
  ownerAnalytics?: OwnerAnalytics | null
  dashboardAnalytics?: DashboardAnalytics | null
  financeDashboard?: FinanceDashboard | null
  vacancy?: VacancyPayload | null
  pendingPayments?: Tables<"payments">[]
  supportRequests?: Tables<"support_requests">[]
  residentReports?: Tables<"support_requests">[]
  leaves?: Tables<"leave_requests">[]
  notices?: NoticeWithEngagement[]
  leads?: LeadRow[]
  reservations?: ReservationRow[]
  onboardingQueue?: ResidentWithOnboarding[]
  today?: Date
}

const priorityRank: Record<OperationsPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function buildOperationsCenterModel({
  ownerAnalytics,
  dashboardAnalytics,
  financeDashboard,
  vacancy,
  pendingPayments = [],
  supportRequests = [],
  residentReports = [],
  leaves = [],
  notices = [],
  leads = [],
  reservations = [],
  onboardingQueue = [],
  today = new Date(),
}: BuildOperationsCenterInput): OperationsCenterModel {
  const dueLeads = leads.filter((lead) =>
    lead.next_follow_up_at ? Date.parse(lead.next_follow_up_at) <= today.getTime() : false
  )
  const pendingAdmissions = dueLeads.length + reservations.length
  const openComplaints = supportRequests.filter(isOpenSupportRequest)
  const pendingLeaves = leaves.filter((leave) => leave.status === "pending")
  const pendingAcknowledgements =
    ownerAnalytics?.communications.noticeAcknowledgementRates.pending ??
    notices.reduce((total, notice) => total + (notice.pending_count ?? 0), 0)
  const queue = [
    ...buildPaymentQueue(pendingPayments),
    ...buildComplaintQueue(openComplaints),
    ...buildLeaveQueue(pendingLeaves),
    ...buildAdmissionQueue(dueLeads, reservations),
    ...buildOnboardingQueue(onboardingQueue),
    ...buildResidentReportQueue(residentReports),
    ...buildNoticeQueue(pendingAcknowledgements, today),
  ]
    .toSorted(sortQueueItems)
    .slice(0, 24)
  const health = buildHealthWidgets({
    ownerAnalytics,
    dashboardAnalytics,
    financeDashboard,
    vacancy,
    pendingPayments,
    openComplaints,
    pendingAcknowledgements,
  })
  const queueByPriority = {
    critical: queue.filter((item) => item.priority === "critical"),
    high: queue.filter((item) => item.priority === "high"),
    medium: queue.filter((item) => item.priority === "medium"),
    low: queue.filter((item) => item.priority === "low"),
  }

  return {
    queue,
    queueByPriority,
    health,
    summary: buildDailySummary(queue, health),
    counts: {
      pendingAdmissions,
      pendingPayments: pendingPayments.length,
      pendingComplaints: openComplaints.length,
      pendingLeaves: pendingLeaves.length,
      onboardingTasks: onboardingQueue.length,
      noticeFollowups: pendingAcknowledgements,
    },
  }
}

function buildPaymentQueue(payments: Tables<"payments">[]): OperationsQueueItem[] {
  return payments.map((payment) => ({
    id: `payment-${payment.id}`,
    title: "Verify payment proof",
    detail: `${payment.amount} submitted by resident ${payment.resident_id.slice(0, 8)}.`,
    source: "payment",
    priority: payment.amount >= 25_000 ? "critical" : payment.amount >= 10_000 ? "high" : "medium",
    href: "/admin/payments",
    createdAt: payment.created_at,
    action: "verify_payment",
  }))
}

function buildComplaintQueue(requests: Tables<"support_requests">[]): OperationsQueueItem[] {
  return requests.map((request) => ({
    id: `complaint-${request.id}`,
    title:
      request.status === "waiting_on_resident"
        ? "Complaint waiting on resident"
        : "Resolve complaint",
    detail: request.subject,
    source: "complaint",
    priority:
      request.priority === "urgent"
        ? "critical"
        : request.priority === "high" || request.status === "waiting_on_resident"
          ? "high"
          : "medium",
    href: "/admin/alerts",
    createdAt: request.updated_at ?? request.created_at,
    action: "resolve_complaint",
  }))
}

function buildLeaveQueue(leaves: Tables<"leave_requests">[]): OperationsQueueItem[] {
  return leaves.map((leave) => ({
    id: `leave-${leave.id}`,
    title: "Approve leave request",
    detail: `${leave.from_date} to ${leave.to_date}`,
    source: "leave",
    priority: "medium",
    href: "/admin/leaves",
    createdAt: leave.created_at,
    action: "approve_leave",
  }))
}

function buildAdmissionQueue(
  leads: LeadRow[],
  reservations: ReservationRow[]
): OperationsQueueItem[] {
  return [
    ...reservations.map((reservation) => ({
      id: `reservation-${reservation.id}`,
      title: "Confirm pending reservation",
      detail: `${reservation.reserved_bed_count} bed${reservation.reserved_bed_count === 1 ? "" : "s"} reserved until ${reservation.reserved_until}.`,
      source: "admission" as const,
      priority: "high" as const,
      href: "/admin/reservations",
      createdAt: reservation.updated_at,
      action: "review" as const,
    })),
    ...leads.map((lead) => ({
      id: `lead-${lead.id}`,
      title: "Follow up admission lead",
      detail: lead.full_name,
      source: "admission" as const,
      priority: "medium" as const,
      href: "/admin/leads",
      createdAt: lead.next_follow_up_at ?? lead.updated_at,
      action: "review" as const,
    })),
  ]
}

function buildOnboardingQueue(
  residents: ResidentWithOnboarding[]
): OperationsQueueItem[] {
  return residents.map((resident) => ({
    id: `onboarding-${resident.id}`,
    title: "Review resident onboarding",
    detail: resident.full_name,
    source: "onboarding",
    priority: resident.onboarding_status === "rejected" ? "high" : "medium",
    href: "/admin/residents/verification",
    createdAt: resident.updated_at,
    action: "review",
  }))
}

function buildResidentReportQueue(
  requests: Tables<"support_requests">[]
): OperationsQueueItem[] {
  return requests
    .filter(isOpenSupportRequest)
    .map((request) => ({
      id: `resident-report-${request.id}`,
      title: "Publish resident report",
      detail: request.subject,
      source: "notice",
      priority:
        request.priority === "urgent"
          ? "critical"
          : request.priority === "high"
            ? "high"
            : "medium",
      href: "/admin/alerts",
      createdAt: request.updated_at ?? request.created_at,
      action: "publish_notice",
    }))
}

function buildNoticeQueue(
  pendingAcknowledgements: number,
  today: Date
): OperationsQueueItem[] {
  if (pendingAcknowledgements <= 0) {
    return []
  }

  return [
    {
      id: "notice-acknowledgement-followup",
      title: "Notice acknowledgement follow-up",
      detail: `${pendingAcknowledgements} resident acknowledgement${pendingAcknowledgements === 1 ? "" : "s"} pending.`,
      source: "notice",
      priority: pendingAcknowledgements > 10 ? "high" : "medium",
      href: "/admin/notices",
      createdAt: today.toISOString(),
      action: "review",
    },
  ]
}

function buildHealthWidgets(input: {
  ownerAnalytics?: OwnerAnalytics | null
  dashboardAnalytics?: DashboardAnalytics | null
  financeDashboard?: FinanceDashboard | null
  vacancy?: VacancyPayload | null
  pendingPayments: Tables<"payments">[]
  openComplaints: Tables<"support_requests">[]
  pendingAcknowledgements: number
}): OperationsHealthWidget[] {
  const pendingDues =
    input.financeDashboard?.kpis.pendingAmount ??
    input.ownerAnalytics?.summary.pendingDues ??
    input.dashboardAnalytics?.finance.pendingDues ??
    0
  const overdueAmount = input.financeDashboard?.kpis.overdueAmount ?? 0
  const occupancy = resolveOccupancySnapshot(input)
  const occupancyRate =
    occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0
  const urgentComplaints = input.openComplaints.filter(
    (request) => request.priority === "urgent"
  ).length
  const noticeReadRate =
    input.ownerAnalytics?.communications.noticeReadRates.percentage ??
    average(input.pendingAcknowledgements > 0 ? [0] : [100])

  return [
    {
      id: "revenue",
      title: "Revenue health",
      value: String(pendingDues),
      detail:
        overdueAmount > 0
          ? `${overdueAmount} overdue, ${input.pendingPayments.length} proofs waiting.`
          : `${input.pendingPayments.length} payment proof${input.pendingPayments.length === 1 ? "" : "s"} waiting.`,
      priority:
        overdueAmount > 50_000
          ? "critical"
          : pendingDues > 50_000 || input.pendingPayments.length > 5
            ? "high"
            : pendingDues > 0 || input.pendingPayments.length > 0
              ? "medium"
              : "low",
      href: "/admin/finance",
    },
    {
      id: "occupancy",
      title: "Occupancy health",
      value: occupancy.total > 0 ? `${occupancyRate}%` : "Not ready",
      detail:
        occupancy.source === "capacity"
          ? `${occupancy.available} available bed${occupancy.available === 1 ? "" : "s"}.`
          : occupancy.total > 0
            ? `${occupancy.occupied} active resident${occupancy.occupied === 1 ? "" : "s"} out of ${occupancy.total}.`
            : "Occupancy signals appear after resident records are available.",
      priority:
        occupancy.total === 0
          ? "low"
          : occupancy.source === "capacity" && occupancy.available <= 2
            ? "high"
            : occupancyRate < 60
              ? "medium"
              : "low",
      href: "/admin/residents",
    },
    {
      id: "complaints",
      title: "Complaint health",
      value: String(input.openComplaints.length),
      detail:
        urgentComplaints > 0
          ? `${urgentComplaints} urgent complaint${urgentComplaints === 1 ? "" : "s"}.`
          : "Open complaint load.",
      priority:
        urgentComplaints > 0
          ? "critical"
          : input.openComplaints.length > 5
            ? "high"
            : input.openComplaints.length > 0
              ? "medium"
              : "low",
      href: "/admin/alerts",
    },
    {
      id: "communication",
      title: "Communication health",
      value: `${noticeReadRate}%`,
      detail:
        input.pendingAcknowledgements > 0
          ? `${input.pendingAcknowledgements} notice acknowledgement${input.pendingAcknowledgements === 1 ? "" : "s"} pending.`
          : "Notice acknowledgement is clear.",
      priority:
        input.pendingAcknowledgements > 10
          ? "high"
          : input.pendingAcknowledgements > 0
            ? "medium"
            : "low",
      href: "/admin/notices",
    },
  ]
}

function resolveOccupancySnapshot(input: {
  ownerAnalytics?: OwnerAnalytics | null
  dashboardAnalytics?: DashboardAnalytics | null
  vacancy?: VacancyPayload | null
}) {
  const summary = input.vacancy?.summary

  if (summary) {
    return {
      source: "capacity" as const,
      total: summary.total_beds,
      occupied: summary.occupied_beds,
      available: summary.available_beds,
    }
  }

  const total =
    input.ownerAnalytics?.summary.totalResidents ??
    input.dashboardAnalytics?.totalResidents ??
    0
  const occupied =
    input.ownerAnalytics?.summary.activeResidents ??
    input.dashboardAnalytics?.residentLifecycle.activeResidents ??
    0

  return {
    source: "resident_records" as const,
    total,
    occupied,
    available: Math.max(total - occupied, 0),
  }
}

function buildDailySummary(
  queue: OperationsQueueItem[],
  health: OperationsHealthWidget[]
) {
  const criticalCount = queue.filter((item) => item.priority === "critical").length
  const highCount = queue.filter((item) => item.priority === "high").length
  const topHealth = health.toSorted(comparePriority)[0]

  if (criticalCount > 0) {
    return `What requires attention today: ${criticalCount} critical item${criticalCount === 1 ? "" : "s"} first, starting with ${queue[0]?.title.toLowerCase()}.`
  }

  if (highCount > 0) {
    return `What requires attention today: ${highCount} high-priority item${highCount === 1 ? "" : "s"} and ${queue.length} total queue item${queue.length === 1 ? "" : "s"}.`
  }

  if (queue.length > 0) {
    return `What requires attention today: ${queue.length} routine operation${queue.length === 1 ? "" : "s"} can be cleared from the queue.`
  }

  return `What requires attention today: operations are clear. ${topHealth?.title ?? "Health"} is healthy.`
}

function sortQueueItems(left: OperationsQueueItem, right: OperationsQueueItem) {
  const priority = priorityRank[left.priority] - priorityRank[right.priority]

  if (priority !== 0) {
    return priority
  }

  return Date.parse(right.createdAt) - Date.parse(left.createdAt)
}

function comparePriority(
  left: { priority: OperationsPriority },
  right: { priority: OperationsPriority }
) {
  return priorityRank[left.priority] - priorityRank[right.priority]
}

function isOpenSupportRequest(request: Tables<"support_requests">) {
  return ["open", "in_progress", "waiting_on_resident"].includes(request.status)
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value))

  if (valid.length === 0) {
    return 0
  }

  return Math.round(valid.reduce((total, value) => total + value, 0) / valid.length)
}
