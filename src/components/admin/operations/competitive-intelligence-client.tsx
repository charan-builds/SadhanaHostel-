"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { Route } from "next"
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  IndianRupee,
  Loader2,
  Megaphone,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { anyRoleHasPermission } from "@/constants/auth"
import {
  useDashboardAnalytics,
  useFinanceDashboard,
  useLeads,
  useLeaves,
  useNotices,
  useOnboardingQueue,
  useOwnerAnalytics,
  usePayments,
  usePublishSupportRequestNotice,
  useReservations,
  useRunFinanceAutomation,
  useSupportRequests,
  useUpdateSupportRequest,
} from "@/hooks"
import {
  buildCompetitiveAdvantageModel,
  type CompetitiveAdvantageModel,
  type CompetitiveFeedItem,
  type CompetitiveFollowup,
  type CompetitivePriority,
  type CompetitiveRiskSignal,
} from "@/lib/competitive-advantage/intelligence"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime, humanizeEnum } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"

type QueryWithRefetch = {
  isLoading?: boolean
  isFetching?: boolean
  error?: unknown
  refetch: () => Promise<unknown>
}

const priorityTone: Record<CompetitivePriority, string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-amber-300 bg-amber-50 text-amber-900",
  medium: "border-blue-200 bg-blue-50 text-blue-900",
  low: "border-emerald-200 bg-emerald-50 text-emerald-900",
}

const priorityLabel: Record<CompetitivePriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export function CompetitiveIntelligenceClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const roles = session?.roles ?? []
  const canAnalytics = anyRoleHasPermission(roles, "analytics.view")
  const canFinance = anyRoleHasPermission(roles, "finance.manage")
  const canAdmissions = anyRoleHasPermission(roles, "admissions.manage")
  const canLeaves = anyRoleHasPermission(roles, "leaves.manage")
  const canNotices = anyRoleHasPermission(roles, "notices.manage")
  const canResidents = anyRoleHasPermission(roles, "residents.manage")
  const analyticsRange = useMemo(
    () => ({
      fromDate: monthsAgoInput(5),
      toDate: todayInput(),
    }),
    []
  )
  const ownerAnalytics = useOwnerAnalytics({
    organizationId: canAnalytics ? organizationId ?? "" : "",
    hostelId,
    fromDate: analyticsRange.fromDate,
    toDate: analyticsRange.toDate,
  })
  const dashboardAnalytics = useDashboardAnalytics({
    organizationId: canAnalytics ? organizationId ?? "" : "",
    hostelId,
  })
  const financeDashboard = useFinanceDashboard(
    organizationId && canFinance
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const pendingPayments = usePayments({
    organizationId: canFinance ? organizationId ?? "" : "",
    hostelId,
    status: "pending",
    page: 1,
    pageSize: 12,
  })
  const failedPayments = usePayments({
    organizationId: canFinance ? organizationId ?? "" : "",
    hostelId,
    status: "failed",
    page: 1,
    pageSize: 8,
  })
  const openSupportRequests = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    status: "open",
    page: 1,
    pageSize: 16,
  })
  const inProgressSupportRequests = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    status: "in_progress",
    page: 1,
    pageSize: 16,
  })
  const waitingSupportRequests = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    status: "waiting_on_resident",
    page: 1,
    pageSize: 16,
  })
  const residentReports = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    status: "open",
    workflow: "resident_report",
    page: 1,
    pageSize: 8,
  })
  const leaves = useLeaves({
    organizationId: canLeaves ? organizationId ?? "" : "",
    hostelId,
    status: "pending",
    page: 1,
    pageSize: 8,
  })
  const notices = useNotices({
    organizationId: canNotices ? organizationId ?? "" : "",
    hostelId,
    activeOnly: true,
    page: 1,
    pageSize: 10,
  })
  const leads = useLeads({
    organizationId: canAdmissions ? organizationId ?? "" : "",
    hostelId,
    followUp: "due",
    page: 1,
    pageSize: 10,
  })
  const reservations = useReservations({
    organizationId: canAdmissions ? organizationId ?? "" : "",
    hostelId,
    status: "pending",
    page: 1,
    pageSize: 8,
  })
  const onboardingQueue = useOnboardingQueue({
    organizationId: canResidents ? organizationId ?? "" : "",
    hostelId,
    page: 1,
    pageSize: 10,
  })
  const runFinanceAutomation = useRunFinanceAutomation()
  const updateSupportRequest = useUpdateSupportRequest()
  const publishRequestNotice = usePublishSupportRequestNotice()

  const queries: QueryWithRefetch[] = [
    { enabled: canAnalytics, query: ownerAnalytics },
    { enabled: canAnalytics, query: dashboardAnalytics },
    { enabled: canFinance, query: financeDashboard },
    { enabled: canFinance, query: pendingPayments },
    { enabled: canFinance, query: failedPayments },
    { enabled: Boolean(organizationId), query: openSupportRequests },
    { enabled: Boolean(organizationId), query: inProgressSupportRequests },
    { enabled: Boolean(organizationId), query: waitingSupportRequests },
    { enabled: Boolean(organizationId), query: residentReports },
    { enabled: canLeaves, query: leaves },
    { enabled: canNotices, query: notices },
    { enabled: canAdmissions, query: leads },
    { enabled: canAdmissions, query: reservations },
    { enabled: canResidents, query: onboardingQueue },
  ]
    .filter((entry) => entry.enabled)
    .map((entry) => entry.query as QueryWithRefetch)
  const isLoading = queries.some((query) => query.isLoading)
  const isFetching = queries.some((query) => query.isFetching)
  const failedQueryCount = queries.filter((query) => query.error).length
  const firstError = queries.find((query) => query.error)?.error
  const firstResidentReport = residentReports.data?.data[0]
  const supportRequests = useMemo(
    () =>
      uniqueSupportRequests([
        ...(openSupportRequests.data?.data ?? []),
        ...(inProgressSupportRequests.data?.data ?? []),
        ...(waitingSupportRequests.data?.data ?? []),
      ]),
    [
      inProgressSupportRequests.data?.data,
      openSupportRequests.data?.data,
      waitingSupportRequests.data?.data,
    ]
  )
  const firstEscalatableComplaint = supportRequests.find((request) =>
    ["urgent", "high"].includes(request.priority)
  )

  const model = useMemo(
    () =>
      buildCompetitiveAdvantageModel({
        ownerAnalytics: ownerAnalytics.data,
        dashboardAnalytics: dashboardAnalytics.data,
        financeDashboard: financeDashboard.data,
        pendingPayments: pendingPayments.data?.data ?? [],
        failedPayments: failedPayments.data?.data ?? [],
        supportRequests,
        residentReports: residentReports.data?.data ?? [],
        leaves: leaves.data?.data ?? [],
        notices: notices.data?.data ?? [],
        leads: leads.data?.data ?? [],
        reservations: reservations.data?.data ?? [],
        onboardingQueue: onboardingQueue.data?.data ?? [],
      }),
    [
      dashboardAnalytics.data,
      failedPayments.data?.data,
      financeDashboard.data,
      leads.data?.data,
      leaves.data?.data,
      notices.data?.data,
      onboardingQueue.data?.data,
      ownerAnalytics.data,
      pendingPayments.data?.data,
      residentReports.data?.data,
      reservations.data?.data,
      supportRequests,
    ]
  )

  async function refetchAll() {
    await Promise.all(queries.map((query) => query.refetch()))
  }

  async function sendPaymentReminders() {
    if (!organizationId || !canFinance) {
      return
    }

    try {
      const result = await runFinanceAutomation.mutateAsync({
        organizationId,
        hostelId,
        name: "payment_reminder",
        dryRun: false,
        payload: {
          dueBeforeDate: todayInput(),
          limit: 200,
        },
      })
      await refetchAll()
      toast.success(
        `${result.result.message} Processed ${result.result.processed}, skipped ${result.result.skipped}.`
      )
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to queue payment reminders."
      )
    }
  }

  async function escalateComplaint(request?: Tables<"support_requests">) {
    if (!organizationId || !request) {
      return
    }

    try {
      await updateSupportRequest.mutateAsync({
        organizationId,
        requestId: request.id,
        priority: "urgent",
        status: "in_progress",
        resolutionNotes:
          "Escalated from Competitive Intelligence for owner-level attention.",
      })
      await refetchAll()
      toast.success("Complaint escalated for owner attention.")
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to escalate complaint."
      )
    }
  }

  async function publishNoticeFromReport(request?: Tables<"support_requests">) {
    if (!organizationId || !request || !canNotices) {
      return
    }

    try {
      await publishRequestNotice.mutateAsync({
        organizationId,
        requestId: request.id,
        title: request.subject,
        body: request.description,
        audienceType: "hostel",
        isPinned: true,
      })
      await refetchAll()
      toast.success("Notice published from resident report.")
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to publish notice."
      )
    }
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Competitive Intelligence"
        badge="Operations Advantage"
        description="Resident activity, payment risk, occupancy movement, complaint escalation, notice engagement, and owner digest in one daily operating view."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isFetching}
              onClick={() => {
                void refetchAll()
              }}
            >
              {isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="size-4" aria-hidden="true" />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              disabled={
                runFinanceAutomation.isPending ||
                !canFinance ||
                !model.automatedFollowups.some((followup) => followup.action === "payment_reminder")
              }
              onClick={() => {
                void sendPaymentReminders()
              }}
            >
              {runFinanceAutomation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <BellRing className="size-4" aria-hidden="true" />
              )}
              Send reminders
            </Button>
          </>
        }
      />

      {failedQueryCount > 0 ? (
        <PartialDataBanner
          title="Some intelligence data could not load"
          detail={getErrorMessage(firstError)}
          failedQueryCount={failedQueryCount}
          isFetching={isFetching}
          onRetry={() => {
            void refetchAll()
          }}
        />
      ) : null}

      {isLoading ? (
        <LoadingGrid />
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Brain className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle>AI-Assisted Operations Summary</CardTitle>
                    <CardDescription>Generated from live operational signals.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-base leading-7 text-foreground md:text-lg">
                  {model.operationsSummary}
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <AssistantSignal
                    title="Revenue"
                    icon={IndianRupee}
                    detail={model.operationsAssistant.revenueSummary}
                  />
                  <AssistantSignal
                    title="Complaints"
                    icon={ShieldAlert}
                    detail={model.operationsAssistant.complaintSummary}
                  />
                  <AssistantSignal
                    title="Occupancy"
                    icon={Users}
                    detail={model.operationsAssistant.occupancySummary}
                  />
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                        Recommended next action
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {model.operationsAssistant.nextAction.label}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        {model.operationsAssistant.nextAction.detail}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={model.operationsAssistant.nextAction.href as Route}>
                        Open
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <DailyDigest digest={model.ownerDailyDigest} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PaymentRiskCard model={model} />
            <VacancyCard model={model} />
            <RevenueForecastCard model={model} />
            <NoticeInsightsCard model={model} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
            <ActivityFeed items={model.activityFeed} />
            <SmartFollowups
              followups={model.automatedFollowups}
              sending={runFinanceAutomation.isPending}
              onSendPaymentReminders={sendPaymentReminders}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <ComplaintEscalations
              escalations={model.complaintEscalations}
              firstComplaint={firstEscalatableComplaint}
              escalating={updateSupportRequest.isPending}
              onEscalate={escalateComplaint}
            />
            <RetentionSignals signals={model.retentionSignals} />
            <ActionCenter
              firstResidentReport={firstResidentReport}
              canPublishNotice={canNotices}
              publishing={publishRequestNotice.isPending}
              onPublishNotice={publishNoticeFromReport}
            />
          </section>
        </>
      )}
    </div>
  )
}

function PaymentRiskCard({ model }: { model: CompetitiveAdvantageModel }) {
  return (
    <InsightCard
      title="Payment Risk"
      icon={CreditCard}
      priority={model.paymentRisk.priority}
      value={formatCurrency(model.paymentRisk.pendingAmount)}
      label={`${model.paymentRisk.pendingPayments} proofs pending`}
      href="/admin/payments"
      detail={
        model.paymentRisk.highRiskResidents > 0
          ? `${model.paymentRisk.highRiskResidents} high-risk collection follow-ups`
          : "No high-risk resident collection queue"
      }
    />
  )
}

function VacancyCard({ model }: { model: CompetitiveAdvantageModel }) {
  const label =
    model.vacancyIntelligence.source === "capacity"
      ? `${model.vacancyIntelligence.availableBeds} beds available`
      : model.vacancyIntelligence.totalBeds > 0
        ? `${model.vacancyIntelligence.occupiedBeds} active residents`
        : "Resident occupancy pending"
  const detail =
    model.vacancyIntelligence.source === "capacity"
      ? `${model.vacancyIntelligence.reservedBeds} reserved beds`
      : model.vacancyIntelligence.totalBeds > 0
        ? `${model.vacancyIntelligence.totalBeds} resident records tracked`
        : "Add resident records to activate occupancy insight"

  return (
    <InsightCard
      title="Occupancy Intelligence"
      icon={Users}
      priority={model.vacancyIntelligence.priority}
      value={`${model.vacancyIntelligence.occupancyRate}%`}
      label={label}
      href="/admin/residents"
      detail={detail}
    />
  )
}

function RevenueForecastCard({ model }: { model: CompetitiveAdvantageModel }) {
  return (
    <InsightCard
      title="Revenue Forecast"
      icon={IndianRupee}
      priority={model.revenueForecast.riskAdjustedPendingDues > 0 ? "medium" : "low"}
      value={formatCurrency(model.revenueForecast.expectedCollectedRevenue)}
      label={`${model.revenueForecast.expectedCollectionRate}% expected collection`}
      href="/admin/owner-dashboard"
      detail={`${formatCurrency(model.revenueForecast.expectedBilling)} planned billing`}
    />
  )
}

function NoticeInsightsCard({ model }: { model: CompetitiveAdvantageModel }) {
  return (
    <InsightCard
      title="Notice Insights"
      icon={Megaphone}
      priority={model.noticeInsights.pendingAcknowledgements > 0 ? "medium" : "low"}
      value={`${model.noticeInsights.acknowledgementRate}%`}
      label={`${model.noticeInsights.pendingAcknowledgements} pending acknowledgements`}
      href="/admin/notices"
      detail={
        model.noticeInsights.weakestNotice
          ? `Weakest: ${model.noticeInsights.weakestNotice.title}`
          : "No weak notice engagement signal"
      }
    />
  )
}

function PartialDataBanner({
  title,
  detail,
  failedQueryCount,
  isFetching,
  onRetry,
}: {
  title: string
  detail?: string
  failedQueryCount: number
  isFetching: boolean
  onRetry: () => void
}) {
  return (
    <Card className="border-amber-300 bg-amber-50 text-amber-950">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              {failedQueryCount} dataset{failedQueryCount === 1 ? "" : "s"} failed.
              {detail ? ` ${detail}` : " The page is showing available data."}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" disabled={isFetching} onClick={onRetry}>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="size-4" aria-hidden="true" />
          )}
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

function InsightCard({
  title,
  icon: Icon,
  priority,
  value,
  label,
  detail,
  href,
}: {
  title: string
  icon: typeof CreditCard
  priority: CompetitivePriority
  value: string
  label: string
  detail: string
  href: string
}) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <PriorityBadge priority={priority} />
        </div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{label}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="min-h-10 text-sm leading-5 text-muted-foreground">{detail}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={href as Route}>
            Open
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function DailyDigest({ digest }: { digest: string[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden="true" />
          <CardTitle>Owner Daily Digest</CardTitle>
        </div>
        <CardDescription>What requires attention today.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {digest.slice(0, 6).map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function AssistantSignal({
  title,
  icon: Icon,
  detail,
}: {
  title: string
  icon: LucideIcon
  detail: string
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-sm leading-5">{detail}</p>
    </div>
  )
}

function ActivityFeed({ items }: { items: CompetitiveFeedItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resident Activity Feed</CardTitle>
        <CardDescription>Payments, complaints, leave approvals, notices, admissions, and onboarding activity.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyBlock
            title="No resident activity needs attention"
            detail="Activity appears here as residents pay, acknowledge notices, raise issues, request leave, or enter onboarding."
          />
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href as Route}
                className="grid gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceIcon source={item.source} />
                    <p className="font-medium">{item.title}</p>
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <time className="text-xs text-muted-foreground">
                  {formatDateTime(item.occurredAt)}
                </time>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SmartFollowups({
  followups,
  sending,
  onSendPaymentReminders,
}: {
  followups: CompetitiveFollowup[]
  sending: boolean
  onSendPaymentReminders: () => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automated Followups</CardTitle>
        <CardDescription>Queue the right nudge from the daily operating queue.</CardDescription>
      </CardHeader>
      <CardContent>
        {followups.length === 0 ? (
          <EmptyBlock
            title="No automated followups due"
            detail="Payment, notice, admissions, and onboarding followups are currently clear."
          />
        ) : (
          <div className="grid gap-3">
            {followups.map((followup) => (
              <div
                key={followup.id}
                className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{followup.title}</p>
                    <PriorityBadge priority={followup.priority} />
                    <Badge variant="outline">{followup.count}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {followup.detail}
                  </p>
                </div>
                {followup.action === "payment_reminder" ? (
                  <Button
                    size="sm"
                    disabled={sending}
                    onClick={() => {
                      void onSendPaymentReminders()
                    }}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <BellRing className="size-4" aria-hidden="true" />
                    )}
                    Send
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={followup.href as Route}>
                      Review
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ComplaintEscalations({
  escalations,
  firstComplaint,
  escalating,
  onEscalate,
}: {
  escalations: CompetitiveRiskSignal[]
  firstComplaint?: Tables<"support_requests">
  escalating: boolean
  onEscalate: (request?: Tables<"support_requests">) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-destructive" aria-hidden="true" />
          <CardTitle>Complaint Escalation</CardTitle>
        </div>
        <CardDescription>High-priority resident issues requiring owner-level attention.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {escalations.length === 0 ? (
          <EmptyBlock
            title="No escalations active"
            detail="High-priority complaints are clear."
          />
        ) : (
          escalations.slice(0, 4).map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))
        )}
        <Button
          variant={firstComplaint ? "default" : "outline"}
          disabled={!firstComplaint || escalating}
          onClick={() => {
            void onEscalate(firstComplaint)
          }}
        >
          {escalating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          Escalate top complaint
        </Button>
      </CardContent>
    </Card>
  )
}

function RetentionSignals({ signals }: { signals: CompetitiveRiskSignal[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserRoundCheck className="size-5 text-primary" aria-hidden="true" />
          <CardTitle>Retention Signals</CardTitle>
        </div>
        <CardDescription>Early warning signals for resident satisfaction and churn.</CardDescription>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <EmptyBlock
            title="Retention signals healthy"
            detail="No churn, onboarding, or complaint signal needs special attention."
          />
        ) : (
          <div className="grid gap-3">
            {signals.slice(0, 5).map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActionCenter({
  firstResidentReport,
  canPublishNotice,
  publishing,
  onPublishNotice,
}: {
  firstResidentReport?: Tables<"support_requests">
  canPublishNotice: boolean
  publishing: boolean
  onPublishNotice: (request?: Tables<"support_requests">) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" aria-hidden="true" />
          <CardTitle>Action Center</CardTitle>
        </div>
        <CardDescription>Fast routes into daily revenue, communication, admissions, and resident work.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button variant="outline" asChild className="justify-start">
          <Link href="/admin/payments">
            <CreditCard className="size-4" aria-hidden="true" />
            Verify payment
          </Link>
        </Button>
        <Button variant="outline" asChild className="justify-start">
          <Link href="/admin/leaves">
            <CalendarClock className="size-4" aria-hidden="true" />
            Approve leave
          </Link>
        </Button>
        <Button variant="outline" asChild className="justify-start">
          <Link href="/admin/notices">
            <Megaphone className="size-4" aria-hidden="true" />
            Publish notice
          </Link>
        </Button>
        <Button
          variant={firstResidentReport ? "default" : "outline"}
          className="justify-start"
          disabled={!firstResidentReport || !canPublishNotice || publishing}
          onClick={() => {
            void onPublishNotice(firstResidentReport)
          }}
        >
          {publishing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Megaphone className="size-4" aria-hidden="true" />
          )}
          Publish resident report
        </Button>
      </CardContent>
    </Card>
  )
}

function SignalRow({ signal }: { signal: CompetitiveRiskSignal }) {
  return (
    <Link
      href={signal.href as Route}
      className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{signal.title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {signal.detail}
        </span>
      </span>
      <PriorityBadge priority={signal.priority} />
    </Link>
  )
}

function PriorityBadge({ priority }: { priority: CompetitivePriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        priorityTone[priority]
      )}
    >
      {priorityLabel[priority]}
    </span>
  )
}

function SourceIcon({ source }: { source: CompetitiveFeedItem["source"] }) {
  const Icon =
    source === "payment"
      ? CreditCard
      : source === "complaint"
        ? ShieldAlert
        : source === "leave"
          ? CalendarClock
          : source === "notice"
            ? Megaphone
            : source === "admission"
              ? TrendingUp
              : UserRoundCheck

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{humanizeEnum(source)}</span>
    </span>
  )
}

function EmptyBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

function uniqueSupportRequests(requests: Tables<"support_requests">[]) {
  return Array.from(new Map(requests.map((request) => [request.id, request])).values())
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Loading intelligence">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-xl border bg-muted/50" />
      ))}
    </div>
  )
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function monthsAgoInput(months: number) {
  const date = new Date()
  date.setMonth(date.getMonth() - months)

  return date.toISOString().slice(0, 10)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}
