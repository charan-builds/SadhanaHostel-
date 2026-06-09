import type { FinanceDashboard } from "@/lib/finance/finance-dashboard"
import type { OwnerAnalytics, DashboardAnalytics } from "@/sdk"
import type { LeadRow, ReservationRow } from "@/types/admissions"
import type { Tables } from "@/types/database"
import type { NoticeWithEngagement } from "@/types/notices"
import type { ResidentWithOnboarding } from "@/repositories/residents.repository"
import type { VacancyPayload } from "@/sdk/admissions.sdk"

export type CompetitivePriority = "critical" | "high" | "medium" | "low"

export type CompetitiveFeedItem = {
  id: string
  title: string
  detail: string
  occurredAt: string
  source:
    | "payment"
    | "complaint"
    | "leave"
    | "notice"
    | "admission"
    | "onboarding"
  priority: CompetitivePriority
  href: string
}

export type CompetitiveFollowup = {
  id: string
  title: string
  detail: string
  priority: CompetitivePriority
  action: "payment_reminder" | "admission_follow_up" | "onboarding_review" | "notice_followup"
  count: number
  href: string
}

export type CompetitiveRiskSignal = {
  id: string
  title: string
  detail: string
  priority: CompetitivePriority
  href: string
}

export type CompetitiveAssistantNextAction = {
  label: string
  detail: string
  href: string
  priority: CompetitivePriority
}

export type CompetitiveAdvantageModel = {
  activityFeed: CompetitiveFeedItem[]
  automatedFollowups: CompetitiveFollowup[]
  noticeInsights: {
    readRate: number
    acknowledgementRate: number
    pendingAcknowledgements: number
    weakestNotice: NoticeWithEngagement | null
    summary: string
  }
  paymentRisk: {
    priority: CompetitivePriority
    overdueAmount: number
    pendingAmount: number
    pendingPayments: number
    highRiskResidents: number
    signals: CompetitiveRiskSignal[]
  }
  complaintEscalations: CompetitiveRiskSignal[]
  ownerDailyDigest: string[]
  vacancyIntelligence: {
    source: "capacity" | "resident_records"
    totalBeds: number
    occupiedBeds: number
    availableBeds: number
    reservedBeds: number
    occupancyRate: number
    priority: CompetitivePriority
    summary: string
  }
  revenueForecast: {
    expectedBilling: number
    expectedCollectionRate: number
    expectedCollectedRevenue: number
    riskAdjustedPendingDues: number
    summary: string
  }
  retentionSignals: CompetitiveRiskSignal[]
  operationsAssistant: {
    revenueSummary: string
    complaintSummary: string
    occupancySummary: string
    dailyDigest: string
    nextAction: CompetitiveAssistantNextAction
  }
  operationsSummary: string
}

type BuildCompetitiveAdvantageInput = {
  ownerAnalytics?: OwnerAnalytics | null
  dashboardAnalytics?: DashboardAnalytics | null
  financeDashboard?: FinanceDashboard | null
  vacancy?: VacancyPayload | null
  pendingPayments?: Tables<"payments">[]
  failedPayments?: Tables<"payments">[]
  supportRequests?: Tables<"support_requests">[]
  residentReports?: Tables<"support_requests">[]
  leaves?: Tables<"leave_requests">[]
  notices?: NoticeWithEngagement[]
  leads?: LeadRow[]
  reservations?: ReservationRow[]
  onboardingQueue?: ResidentWithOnboarding[]
  today?: Date
}

export function buildCompetitiveAdvantageModel({
  ownerAnalytics,
  dashboardAnalytics,
  financeDashboard,
  vacancy,
  pendingPayments = [],
  failedPayments = [],
  supportRequests = [],
  residentReports = [],
  leaves = [],
  notices = [],
  leads = [],
  reservations = [],
  onboardingQueue = [],
  today = new Date(),
}: BuildCompetitiveAdvantageInput): CompetitiveAdvantageModel {
  const activityFeed = buildActivityFeed({
    pendingPayments,
    supportRequests,
    leaves,
    notices,
    leads,
    reservations,
    onboardingQueue,
  })
  const noticeInsights = buildNoticeInsights(ownerAnalytics, notices)
  const paymentRisk = buildPaymentRisk({
    ownerAnalytics,
    dashboardAnalytics,
    financeDashboard,
    pendingPayments,
    failedPayments,
  })
  const complaintEscalations = buildComplaintEscalations([
    ...supportRequests,
    ...residentReports,
  ])
  const automatedFollowups = buildAutomatedFollowups({
    ownerAnalytics,
    financeDashboard,
    noticeInsights,
    leads,
    onboardingQueue,
    today,
  })
  const vacancyIntelligence = buildVacancyIntelligence({
    vacancy,
    ownerAnalytics,
    dashboardAnalytics,
  })
  const revenueForecast = buildRevenueForecast(ownerAnalytics, financeDashboard)
  const retentionSignals = buildRetentionSignals({
    ownerAnalytics,
    supportRequests,
    onboardingQueue,
  })
  const ownerDailyDigest = buildOwnerDailyDigest({
    paymentRisk,
    complaintEscalations,
    noticeInsights,
    vacancyIntelligence,
    revenueForecast,
    retentionSignals,
    automatedFollowups,
  })
  const operationsAssistant = buildOperationsAssistant({
    paymentRisk,
    complaintEscalations,
    vacancyIntelligence,
    revenueForecast,
    ownerDailyDigest,
    automatedFollowups,
  })

  return {
    activityFeed,
    automatedFollowups,
    noticeInsights,
    paymentRisk,
    complaintEscalations,
    ownerDailyDigest,
    vacancyIntelligence,
    revenueForecast,
    retentionSignals,
    operationsAssistant,
    operationsSummary: buildOperationsSummary({
      paymentRisk,
      complaintEscalations,
      noticeInsights,
      vacancyIntelligence,
      automatedFollowups,
    }),
  }
}

function buildActivityFeed(input: {
  pendingPayments: Tables<"payments">[]
  supportRequests: Tables<"support_requests">[]
  leaves: Tables<"leave_requests">[]
  notices: NoticeWithEngagement[]
  leads: LeadRow[]
  reservations: ReservationRow[]
  onboardingQueue: ResidentWithOnboarding[]
}): CompetitiveFeedItem[] {
  return [
    ...input.pendingPayments.map((payment): CompetitiveFeedItem => ({
      id: `payment-${payment.id}`,
      title: "Payment proof waiting",
      detail: `Resident ${payment.resident_id.slice(0, 8)} submitted payment proof.`,
      occurredAt: payment.created_at,
      source: "payment",
      priority: payment.amount >= 10_000 ? "high" : "medium",
      href: "/admin/payments",
    })),
    ...input.supportRequests.map((request): CompetitiveFeedItem => ({
      id: `support-${request.id}`,
      title: "Complaint active",
      detail: request.subject,
      occurredAt: request.updated_at ?? request.created_at,
      source: "complaint",
      priority: request.priority === "urgent" ? "critical" : request.priority,
      href: "/admin/alerts",
    })),
    ...input.leaves.map((leave): CompetitiveFeedItem => ({
      id: `leave-${leave.id}`,
      title: "Leave approval pending",
      detail: `${leave.from_date} to ${leave.to_date}`,
      occurredAt: leave.created_at,
      source: "leave",
      priority: "medium",
      href: "/admin/leaves",
    })),
    ...input.notices.map((notice): CompetitiveFeedItem => ({
      id: `notice-${notice.id}`,
      title: notice.requires_acknowledgement
        ? "Notice acknowledgement tracking"
        : "Notice engagement tracking",
      detail: notice.title,
      occurredAt: notice.published_at ?? notice.updated_at,
      source: "notice",
      priority: notice.pending_count > 0 ? "high" : "low",
      href: "/admin/notices",
    })),
    ...input.leads.map((lead): CompetitiveFeedItem => ({
      id: `lead-${lead.id}`,
      title: "Admission follow-up due",
      detail: lead.full_name,
      occurredAt: lead.next_follow_up_at ?? lead.updated_at,
      source: "admission",
      priority: "medium",
      href: "/admin/leads",
    })),
    ...input.reservations.map((reservation): CompetitiveFeedItem => ({
      id: `reservation-${reservation.id}`,
      title: "Reservation pending",
      detail: `${reservation.reserved_bed_count} bed${reservation.reserved_bed_count === 1 ? "" : "s"} reserved until ${reservation.reserved_until}`,
      occurredAt: reservation.updated_at,
      source: "admission",
      priority: "high",
      href: "/admin/reservations",
    })),
    ...input.onboardingQueue.map((resident): CompetitiveFeedItem => ({
      id: `onboarding-${resident.id}`,
      title: "Onboarding review waiting",
      detail: resident.full_name,
      occurredAt: resident.updated_at,
      source: "onboarding",
      priority: resident.onboarding_status === "rejected" ? "high" : "medium",
      href: "/admin/residents/verification",
    })),
  ]
    .filter((item) => Boolean(item.occurredAt))
    .toSorted((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, 12)
}

function buildAutomatedFollowups(input: {
  ownerAnalytics?: OwnerAnalytics | null
  financeDashboard?: FinanceDashboard | null
  noticeInsights: CompetitiveAdvantageModel["noticeInsights"]
  leads: LeadRow[]
  onboardingQueue: ResidentWithOnboarding[]
  today: Date
}): CompetitiveFollowup[] {
  const followups: CompetitiveFollowup[] = []
  const pendingDues = input.financeDashboard?.kpis.pendingAmount ?? input.ownerAnalytics?.summary.pendingDues ?? 0
  const unpaidResidents = input.ownerAnalytics?.summary.unpaidResidents ?? input.financeDashboard?.kpis.residentsWithPending ?? 0
  const dueLeads = input.leads.filter((lead) =>
    lead.next_follow_up_at ? Date.parse(lead.next_follow_up_at) <= input.today.getTime() : false
  )

  if (pendingDues > 0 || unpaidResidents > 0) {
    followups.push({
      id: "payment-reminders",
      title: "Payment reminders",
      detail: `${unpaidResidents} unpaid resident${unpaidResidents === 1 ? "" : "s"} need reminder coverage.`,
      priority: pendingDues > 50_000 ? "critical" : "high",
      action: "payment_reminder",
      count: unpaidResidents,
      href: "/admin/finance",
    })
  }

  if (dueLeads.length > 0) {
    followups.push({
      id: "admission-followups",
      title: "Admission follow-ups",
      detail: `${dueLeads.length} lead${dueLeads.length === 1 ? "" : "s"} need a call or WhatsApp follow-up today.`,
      priority: "medium",
      action: "admission_follow_up",
      count: dueLeads.length,
      href: "/admin/leads",
    })
  }

  if (input.onboardingQueue.length > 0) {
    followups.push({
      id: "onboarding-review",
      title: "Resident onboarding review",
      detail: `${input.onboardingQueue.length} resident profile${input.onboardingQueue.length === 1 ? "" : "s"} need verification.`,
      priority: "high",
      action: "onboarding_review",
      count: input.onboardingQueue.length,
      href: "/admin/residents/verification",
    })
  }

  if (input.noticeInsights.pendingAcknowledgements > 0) {
    followups.push({
      id: "notice-followup",
      title: "Notice acknowledgement follow-up",
      detail: `${input.noticeInsights.pendingAcknowledgements} acknowledgement${input.noticeInsights.pendingAcknowledgements === 1 ? "" : "s"} pending.`,
      priority: "medium",
      action: "notice_followup",
      count: input.noticeInsights.pendingAcknowledgements,
      href: "/admin/notices",
    })
  }

  return followups.toSorted(comparePriority)
}

function buildNoticeInsights(
  ownerAnalytics: OwnerAnalytics | null | undefined,
  notices: NoticeWithEngagement[]
) {
  const weakestNotice =
    notices
      .filter((notice) => notice.requires_acknowledgement || notice.total_recipients > 0)
      .toSorted((left, right) => {
        const leftScore = left.requires_acknowledgement
          ? left.acknowledgement_percentage
          : left.read_percentage
        const rightScore = right.requires_acknowledgement
          ? right.acknowledgement_percentage
          : right.read_percentage

        return leftScore - rightScore
      })[0] ?? null
  const pendingAcknowledgements =
    ownerAnalytics?.communications.noticeAcknowledgementRates.pending ??
    notices.reduce((total, notice) => total + (notice.pending_count ?? 0), 0)
  const readRate =
    ownerAnalytics?.communications.noticeReadRates.percentage ??
    average(notices.map((notice) => notice.read_percentage))
  const acknowledgementRate =
    ownerAnalytics?.communications.noticeAcknowledgementRates.percentage ??
    average(
      notices
        .filter((notice) => notice.requires_acknowledgement)
        .map((notice) => notice.acknowledgement_percentage)
    )

  return {
    readRate,
    acknowledgementRate,
    pendingAcknowledgements,
    weakestNotice,
    summary:
      pendingAcknowledgements > 0
        ? `${pendingAcknowledgements} notice acknowledgement${pendingAcknowledgements === 1 ? "" : "s"} still need follow-up.`
        : "Notice acknowledgement is healthy right now.",
  }
}

function buildPaymentRisk(input: {
  ownerAnalytics?: OwnerAnalytics | null
  dashboardAnalytics?: DashboardAnalytics | null
  financeDashboard?: FinanceDashboard | null
  pendingPayments: Tables<"payments">[]
  failedPayments: Tables<"payments">[]
}) {
  const overdueAmount = input.financeDashboard?.kpis.overdueAmount ?? 0
  const pendingAmount =
    input.financeDashboard?.kpis.pendingAmount ??
    input.ownerAnalytics?.summary.pendingDues ??
    input.dashboardAnalytics?.finance.pendingDues ??
    0
  const highRiskResidents =
    (input.financeDashboard?.attention.critical.length ?? 0) +
    (input.financeDashboard?.attention.high.length ?? 0)
  const pendingPayments =
    input.pendingPayments.length || input.dashboardAnalytics?.finance.pendingPayments || 0
  const signals: CompetitiveRiskSignal[] = []

  if (overdueAmount > 0) {
    signals.push({
      id: "overdue-dues",
      title: "Overdue dues",
      detail: `${overdueAmount} remains overdue.`,
      priority: overdueAmount > 50_000 ? "critical" : "high",
      href: "/admin/finance/collections",
    })
  }

  if (pendingPayments > 0) {
    signals.push({
      id: "payment-verification",
      title: "Payment proof verification",
      detail: `${pendingPayments} payment proof${pendingPayments === 1 ? "" : "s"} waiting.`,
      priority: pendingPayments > 5 ? "high" : "medium",
      href: "/admin/payments",
    })
  }

  if (input.failedPayments.length > 0) {
    signals.push({
      id: "failed-payments",
      title: "Rejected or failed payments",
      detail: `${input.failedPayments.length} failed payment${input.failedPayments.length === 1 ? "" : "s"} need resident correction.`,
      priority: "medium",
      href: "/admin/payments",
    })
  }

  return {
    priority: signals[0]?.priority ?? "low",
    overdueAmount,
    pendingAmount,
    pendingPayments,
    highRiskResidents,
    signals,
  }
}

function buildComplaintEscalations(
  requests: Tables<"support_requests">[]
): CompetitiveRiskSignal[] {
  return requests
    .filter((request) => ["open", "in_progress", "waiting_on_resident"].includes(request.status))
    .filter((request) => request.priority === "urgent" || request.priority === "high")
    .map((request): CompetitiveRiskSignal => ({
      id: request.id,
      title: request.subject,
      detail: `${request.category} - ${request.status}`,
      priority: request.priority === "urgent" ? "critical" : "high",
      href: "/admin/alerts",
    }))
    .toSorted(comparePriority)
    .slice(0, 8)
}

function buildVacancyIntelligence(input: {
  vacancy?: VacancyPayload | null
  ownerAnalytics?: OwnerAnalytics | null
  dashboardAnalytics?: DashboardAnalytics | null
}) {
  const summary = input.vacancy?.summary
  const source: CompetitiveAdvantageModel["vacancyIntelligence"]["source"] = summary
    ? "capacity"
    : "resident_records"
  const totalBeds =
    summary?.total_beds ??
    input.ownerAnalytics?.summary.totalResidents ??
    input.dashboardAnalytics?.totalResidents ??
    0
  const occupiedBeds =
    summary?.occupied_beds ??
    input.ownerAnalytics?.summary.activeResidents ??
    input.dashboardAnalytics?.residentLifecycle.activeResidents ??
    0
  const availableBeds = summary?.available_beds ?? Math.max(totalBeds - occupiedBeds, 0)
  const reservedBeds = summary?.reserved_beds ?? 0
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0
  const priority: CompetitivePriority =
    totalBeds === 0
      ? "low"
      : source === "capacity" && availableBeds <= 2
        ? "high"
        : occupancyRate < 60
          ? "medium"
          : "low"

  return {
    source,
    totalBeds,
    occupiedBeds,
    availableBeds,
    reservedBeds,
    occupancyRate,
    priority,
    summary:
      totalBeds === 0
        ? "Occupancy signals are not available yet."
        : source === "capacity" && availableBeds <= 2
          ? "Capacity is tight. Prioritize confirmed admissions and room readiness."
          : occupancyRate < 60
            ? "Occupancy can improve. Admissions follow-up should be active today."
            : source === "capacity"
              ? "Capacity and occupancy are in a healthy operating range."
              : "Resident occupancy is in a healthy operating range.",
  }
}

function buildRevenueForecast(
  ownerAnalytics?: OwnerAnalytics | null,
  financeDashboard?: FinanceDashboard | null
) {
  const forecast =
    ownerAnalytics?.forecasts.revenue ?? financeDashboard?.owner.forecasts.revenue
  const expectedBilling = forecast?.nextMonthExpectedBilling ?? 0
  const expectedCollectionRate = forecast?.expectedCollectionRate ?? 0
  const expectedCollectedRevenue = forecast?.expectedCollectedRevenue ?? 0
  const riskAdjustedPendingDues = forecast?.riskAdjustedPendingDues ?? 0

  return {
    expectedBilling,
    expectedCollectionRate,
    expectedCollectedRevenue,
    riskAdjustedPendingDues,
    summary:
      expectedBilling > 0
        ? `Next month forecast expects ${expectedCollectionRate}% collection on planned billing.`
        : "Revenue forecast will appear after billing and payment history is available.",
  }
}

function buildRetentionSignals(input: {
  ownerAnalytics?: OwnerAnalytics | null
  supportRequests: Tables<"support_requests">[]
  onboardingQueue: ResidentWithOnboarding[]
}): CompetitiveRiskSignal[] {
  const signals: CompetitiveRiskSignal[] = []
  const churn = input.ownerAnalytics?.summary.residentChurn ?? 0
  const averageStayDurationDays = input.ownerAnalytics?.summary.averageStayDurationDays ?? 0
  const openComplaints = input.supportRequests.filter((request) =>
    ["open", "in_progress", "waiting_on_resident"].includes(request.status)
  ).length

  if (churn > 0) {
    signals.push({
      id: "resident-churn",
      title: "Resident churn signal",
      detail: `${churn} resident churn event${churn === 1 ? "" : "s"} in the analytics range.`,
      priority: churn > 3 ? "high" : "medium",
      href: "/admin/owner-dashboard",
    })
  }

  if (openComplaints > 0) {
    signals.push({
      id: "open-complaints",
      title: "Open complaint load",
      detail: `${openComplaints} open complaint${openComplaints === 1 ? "" : "s"} can affect resident satisfaction.`,
      priority: openComplaints > 5 ? "high" : "medium",
      href: "/admin/alerts",
    })
  }

  if (input.onboardingQueue.length > 0) {
    signals.push({
      id: "onboarding-friction",
      title: "Onboarding friction",
      detail: `${input.onboardingQueue.length} resident${input.onboardingQueue.length === 1 ? "" : "s"} still need onboarding review.`,
      priority: "medium",
      href: "/admin/residents/verification",
    })
  }

  if (averageStayDurationDays > 0 && averageStayDurationDays < 90) {
    signals.push({
      id: "short-average-stay",
      title: "Short average stay",
      detail: `Average stay is ${averageStayDurationDays} days in the current range.`,
      priority: "medium",
      href: "/admin/owner-dashboard",
    })
  }

  return signals.toSorted(comparePriority)
}

function buildOwnerDailyDigest(input: {
  paymentRisk: CompetitiveAdvantageModel["paymentRisk"]
  complaintEscalations: CompetitiveRiskSignal[]
  noticeInsights: CompetitiveAdvantageModel["noticeInsights"]
  vacancyIntelligence: CompetitiveAdvantageModel["vacancyIntelligence"]
  revenueForecast: CompetitiveAdvantageModel["revenueForecast"]
  retentionSignals: CompetitiveRiskSignal[]
  automatedFollowups: CompetitiveFollowup[]
}) {
  const digest = [
    input.paymentRisk.signals[0]
      ? input.paymentRisk.signals[0].detail
      : "Payment risk is controlled.",
    input.complaintEscalations.length > 0
      ? `${input.complaintEscalations.length} complaint escalation${input.complaintEscalations.length === 1 ? "" : "s"} need owner visibility.`
      : "No high-priority complaint escalation is active.",
    input.noticeInsights.summary,
    input.vacancyIntelligence.summary,
    input.revenueForecast.summary,
  ]

  if (input.retentionSignals[0]) {
    digest.push(input.retentionSignals[0].detail)
  }

  if (input.automatedFollowups[0]) {
    digest.push(input.automatedFollowups[0].detail)
  }

  return digest
}

function buildOperationsAssistant(input: {
  paymentRisk: CompetitiveAdvantageModel["paymentRisk"]
  complaintEscalations: CompetitiveRiskSignal[]
  vacancyIntelligence: CompetitiveAdvantageModel["vacancyIntelligence"]
  revenueForecast: CompetitiveAdvantageModel["revenueForecast"]
  ownerDailyDigest: string[]
  automatedFollowups: CompetitiveFollowup[]
}) {
  const topFollowup = input.automatedFollowups[0]
  const topComplaint = input.complaintEscalations[0]
  const topPaymentRisk = input.paymentRisk.signals[0]
  const nextAction: CompetitiveAssistantNextAction = topFollowup
    ? {
        label: topFollowup.title,
        detail: topFollowup.detail,
        href: topFollowup.href,
        priority: topFollowup.priority,
      }
    : topComplaint
      ? {
          label: "Escalate complaint",
          detail: topComplaint.detail,
          href: topComplaint.href,
          priority: topComplaint.priority,
        }
      : topPaymentRisk
        ? {
            label: topPaymentRisk.title,
            detail: topPaymentRisk.detail,
            href: topPaymentRisk.href,
            priority: topPaymentRisk.priority,
          }
        : {
            label: "Review daily dashboard",
            detail: "No urgent operating action is active. Review the owner dashboard and keep monitoring.",
            href: "/admin/owner-dashboard",
            priority: "low",
          }

  return {
    revenueSummary:
      input.paymentRisk.pendingAmount > 0
        ? `${input.paymentRisk.pendingPayments} payment proof${input.paymentRisk.pendingPayments === 1 ? "" : "s"} and pending dues of ${input.paymentRisk.pendingAmount} need collection attention.`
        : input.revenueForecast.expectedBilling > 0
          ? `Forecasted collection is ${input.revenueForecast.expectedCollectionRate}% on expected billing.`
          : "Revenue signals are calm; forecast will sharpen as billing history grows.",
    complaintSummary:
      input.complaintEscalations.length > 0
        ? `${input.complaintEscalations.length} high-priority complaint${input.complaintEscalations.length === 1 ? "" : "s"} need owner attention.`
        : "No high-priority complaint escalation is active.",
    occupancySummary: input.vacancyIntelligence.summary,
    dailyDigest: input.ownerDailyDigest.slice(0, 3).join(" "),
    nextAction,
  }
}

function buildOperationsSummary(input: {
  paymentRisk: CompetitiveAdvantageModel["paymentRisk"]
  complaintEscalations: CompetitiveRiskSignal[]
  noticeInsights: CompetitiveAdvantageModel["noticeInsights"]
  vacancyIntelligence: CompetitiveAdvantageModel["vacancyIntelligence"]
  automatedFollowups: CompetitiveFollowup[]
}) {
  const risks = [
    input.paymentRisk.signals[0]?.title,
    input.complaintEscalations[0]?.title,
    input.noticeInsights.pendingAcknowledgements > 0 ? "notice follow-up" : null,
    input.vacancyIntelligence.priority !== "low" ? "occupancy management" : null,
  ].filter(Boolean)

  if (risks.length === 0) {
    return "Operations are healthy today. Keep monitoring payment verification, resident complaints, notice engagement, and occupancy movement."
  }

  return `Focus today on ${risks.join(", ")}. ${input.automatedFollowups.length} automated follow-up path${input.automatedFollowups.length === 1 ? "" : "s"} can reduce manual work.`
}

function comparePriority(
  left: { priority: CompetitivePriority },
  right: { priority: CompetitivePriority }
) {
  const rank: Record<CompetitivePriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return rank[left.priority] - rank[right.priority]
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value))

  if (valid.length === 0) {
    return 0
  }

  return Math.round(valid.reduce((total, value) => total + value, 0) / valid.length)
}
