"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { Route } from "next"
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  IndianRupee,
  Loader2,
  Megaphone,
  RefreshCcw,
  ShieldAlert,
  UserRoundCheck,
  UserRoundPlus,
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
  useReviewLeave,
  useRunFinanceAutomation,
  useSupportRequests,
  useUpdateSupportRequest,
  useVerifyPayment,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime, humanizeEnum } from "@/lib/format"
import {
  buildOperationsCenterModel,
  type OperationsHealthWidget,
  type OperationsPriority,
  type OperationsQueueItem,
  type OperationsQueueSource,
} from "@/lib/operations-center/operations-center"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"

type QueryWithRefetch = {
  isLoading?: boolean
  isFetching?: boolean
  error?: unknown
  refetch: () => Promise<unknown>
}

const priorityTone: Record<OperationsPriority, string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-amber-300 bg-amber-50 text-amber-900",
  medium: "border-blue-200 bg-blue-50 text-blue-900",
  low: "border-emerald-200 bg-emerald-50 text-emerald-900",
}

const priorityLabel: Record<OperationsPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

export function OperationsCenterClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const roles = session?.roles ?? []
  const canAnalytics = anyRoleHasPermission(roles, "analytics.view")
  const canFinance = anyRoleHasPermission(roles, "finance.manage")
  const canVerifyPayments = anyRoleHasPermission(roles, "payments.verify")
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
    pageSize: 10,
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
    pageSize: 10,
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
  const verifyPayment = useVerifyPayment()
  const approveLeave = useReviewLeave("approve")
  const updateSupportRequest = useUpdateSupportRequest()
  const runFinanceAutomation = useRunFinanceAutomation()
  const publishNotice = usePublishSupportRequestNotice()
  const activeQueries = [
    { enabled: canAnalytics, query: ownerAnalytics },
    { enabled: canAnalytics, query: dashboardAnalytics },
    { enabled: canFinance, query: financeDashboard },
    { enabled: canFinance, query: pendingPayments },
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
  const isLoading = activeQueries.some((query) => query.isLoading)
  const isFetching = activeQueries.some((query) => query.isFetching)
  const failedQueryCount = activeQueries.filter((query) => query.error).length
  const firstError = activeQueries.find((query) => query.error)?.error
  const pendingPayment = pendingPayments.data?.data[0]
  const pendingLeave = leaves.data?.data[0]
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
  const topComplaint = chooseTopComplaint(supportRequests)
  const residentReport = residentReports.data?.data[0]
  const reminderDueAmount =
    financeDashboard.data?.kpis.pendingAmount ?? ownerAnalytics.data?.summary.pendingDues ?? 0
  const model = useMemo(
    () =>
      buildOperationsCenterModel({
        ownerAnalytics: ownerAnalytics.data,
        dashboardAnalytics: dashboardAnalytics.data,
        financeDashboard: financeDashboard.data,
        pendingPayments: pendingPayments.data?.data ?? [],
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
    await Promise.all(activeQueries.map((query) => query.refetch()))
  }

  async function verifyTopPayment(payment?: Tables<"payments">) {
    if (!organizationId || !payment || !canVerifyPayments) {
      return
    }

    try {
      await verifyPayment.mutateAsync({
        organizationId,
        paymentId: payment.id,
        idempotencyKey: `operations-verify-${payment.id}`,
      })
      await refetchAll()
      toast.success("Payment verified from Operations Center.")
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Unable to verify payment."
      )
    }
  }

  async function approveTopLeave(leave?: Tables<"leave_requests">) {
    if (!organizationId || !leave || !canLeaves) {
      return
    }

    try {
      await approveLeave.mutateAsync({
        organizationId,
        leaveRequestId: leave.id,
      })
      await refetchAll()
      toast.success("Leave request approved.")
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Unable to approve leave."
      )
    }
  }

  async function resolveTopComplaint(request?: Tables<"support_requests">) {
    if (!organizationId || !request) {
      return
    }

    try {
      await updateSupportRequest.mutateAsync({
        organizationId,
        requestId: request.id,
        status: "resolved",
        resolutionNotes: "Resolved from Operations Center daily queue.",
      })
      await refetchAll()
      toast.success("Complaint resolved.")
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Unable to resolve complaint."
      )
    }
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
          : "Unable to send payment reminders."
      )
    }
  }

  async function publishTopNotice(request?: Tables<"support_requests">) {
    if (!organizationId || !request || !canNotices) {
      return
    }

    try {
      await publishNotice.mutateAsync({
        organizationId,
        requestId: request.id,
        audienceType: "hostel",
        isPinned: request.category === "safety" || request.priority === "urgent",
      })
      await refetchAll()
      toast.success("Resident report published as a notice.")
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Unable to publish notice."
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
        title="Operations Center"
        badge="Daily Command"
        description="What requires attention today across admissions, payments, complaints, leaves, onboarding, notices, and operating health."
        actions={
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
        }
      />

      {failedQueryCount > 0 ? (
        <PartialDataBanner
          title="Some operations data could not load"
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
          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <DailySummary summary={model.summary} counts={model.counts} />
            <QuickOperationsActions
              pendingPayment={pendingPayment}
              pendingLeave={pendingLeave}
              topComplaint={topComplaint}
              residentReport={residentReport}
              canVerifyPayments={canVerifyPayments}
              canLeaves={canLeaves}
              canFinance={canFinance}
              canNotices={canNotices}
              reminderDueAmount={reminderDueAmount}
              verifying={verifyPayment.isPending}
              approving={approveLeave.isPending}
              resolving={updateSupportRequest.isPending}
              sending={runFinanceAutomation.isPending}
              publishing={publishNotice.isPending}
              onVerify={verifyTopPayment}
              onApprove={approveTopLeave}
              onResolve={resolveTopComplaint}
              onSendReminders={sendPaymentReminders}
              onPublish={publishTopNotice}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {model.health.map((widget) => (
              <HealthCard key={widget.id} widget={widget} />
            ))}
          </section>

          <OperationsQueue queueByPriority={model.queueByPriority} queue={model.queue} />
        </>
      )}
    </div>
  )
}

function DailySummary({
  summary,
  counts,
}: {
  summary: string
  counts: ReturnType<typeof buildOperationsCenterModel>["counts"]
}) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Daily Summary</CardTitle>
            <CardDescription>What requires attention today?</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-base leading-7 text-foreground md:text-lg">{summary}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Admissions" value={counts.pendingAdmissions} />
          <MiniMetric label="Payments" value={counts.pendingPayments} />
          <MiniMetric label="Complaints" value={counts.pendingComplaints} />
          <MiniMetric label="Leaves" value={counts.pendingLeaves} />
          <MiniMetric label="Onboarding" value={counts.onboardingTasks} />
          <MiniMetric label="Notices" value={counts.noticeFollowups} />
        </div>
      </CardContent>
    </Card>
  )
}

function QuickOperationsActions({
  pendingPayment,
  pendingLeave,
  topComplaint,
  residentReport,
  canVerifyPayments,
  canLeaves,
  canFinance,
  canNotices,
  reminderDueAmount,
  verifying,
  approving,
  resolving,
  sending,
  publishing,
  onVerify,
  onApprove,
  onResolve,
  onSendReminders,
  onPublish,
}: {
  pendingPayment?: Tables<"payments">
  pendingLeave?: Tables<"leave_requests">
  topComplaint?: Tables<"support_requests">
  residentReport?: Tables<"support_requests">
  canVerifyPayments: boolean
  canLeaves: boolean
  canFinance: boolean
  canNotices: boolean
  reminderDueAmount: number
  verifying: boolean
  approving: boolean
  resolving: boolean
  sending: boolean
  publishing: boolean
  onVerify: (payment?: Tables<"payments">) => Promise<void>
  onApprove: (leave?: Tables<"leave_requests">) => Promise<void>
  onResolve: (request?: Tables<"support_requests">) => Promise<void>
  onSendReminders: () => Promise<void>
  onPublish: (request?: Tables<"support_requests">) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>One-Click Actions</CardTitle>
        <CardDescription>Clear the top eligible task or open the full module for review.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <ActionButton
          icon={CreditCard}
          label="Verify payment"
          disabled={!pendingPayment || !canVerifyPayments || verifying}
          loading={verifying}
          onClick={() => onVerify(pendingPayment)}
        />
        <ActionButton
          icon={CalendarCheck}
          label="Approve leave"
          disabled={!pendingLeave || !canLeaves || approving}
          loading={approving}
          onClick={() => onApprove(pendingLeave)}
        />
        <ActionButton
          icon={ShieldAlert}
          label="Resolve complaint"
          disabled={!topComplaint || resolving}
          loading={resolving}
          onClick={() => onResolve(topComplaint)}
        />
        <ActionButton
          icon={BellRing}
          label="Send reminders"
          disabled={!canFinance || reminderDueAmount <= 0 || sending}
          loading={sending}
          onClick={onSendReminders}
        />
        <ActionButton
          icon={Megaphone}
          label="Publish notice"
          disabled={!residentReport || !canNotices || publishing}
          loading={publishing}
          onClick={() => onPublish(residentReport)}
        />
      </CardContent>
    </Card>
  )
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  loading,
  onClick,
}: {
  icon: LucideIcon
  label: string
  disabled: boolean
  loading: boolean
  onClick: () => Promise<void>
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="justify-start"
      disabled={disabled}
      onClick={() => {
        void onClick()
      }}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="size-4" aria-hidden="true" />
      )}
      {label}
    </Button>
  )
}

function HealthCard({ widget }: { widget: OperationsHealthWidget }) {
  const Icon =
    widget.id === "revenue"
      ? IndianRupee
      : widget.id === "occupancy"
        ? Users
        : widget.id === "complaints"
          ? ShieldAlert
          : Megaphone

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <PriorityBadge priority={widget.priority} />
        </div>
        <div>
          <CardTitle className="text-base">{widget.title}</CardTitle>
          <CardDescription>{widget.detail}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-2xl font-semibold tracking-tight">
          {widget.id === "revenue" ? formatCurrency(Number(widget.value)) : widget.value}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={widget.href as Route}>
            Open
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function OperationsQueue({
  queueByPriority,
  queue,
}: {
  queueByPriority: Record<OperationsPriority, OperationsQueueItem[]>
  queue: OperationsQueueItem[]
}) {
  const priorities: OperationsPriority[] = ["critical", "high", "medium", "low"]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Daily Operations Queue</CardTitle>
            <CardDescription>Ranked work across admissions, money, support, leave, onboarding, and communication.</CardDescription>
          </div>
          <Badge variant={queue.length > 0 ? "secondary" : "default"}>
            {queue.length > 0 ? `${queue.length} active` : "All clear"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <div className="rounded-lg border border-success/25 bg-success-surface p-4 text-success-foreground">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">No daily operations blockers</p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  Admissions, payments, complaints, leave approvals, onboarding, and notices are clear.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            {priorities.map((priority) => {
              const items = queueByPriority[priority]

              if (items.length === 0) {
                return null
              }

              return (
                <section key={priority} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                      {priorityLabel[priority]}
                    </h2>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <QueueItem key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function QueueItem({ item }: { item: OperationsQueueItem }) {
  const Icon = sourceIcon[item.source]

  return (
    <Link
      href={item.href as Route}
      className="grid gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.title}</span>
          <PriorityBadge priority={item.priority} />
          <Badge variant="outline">{humanizeEnum(item.source)}</Badge>
        </span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">{item.detail}</span>
      </span>
      <time className="text-xs text-muted-foreground sm:text-right">
        {formatDateTime(item.createdAt)}
      </time>
    </Link>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: OperationsPriority }) {
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
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
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

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Loading operations center">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-xl border bg-muted/50" />
      ))}
    </div>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

function chooseTopComplaint(requests: Tables<"support_requests">[]) {
  return requests
    .filter((request) => ["open", "in_progress", "waiting_on_resident"].includes(request.status))
    .toSorted((left, right) => {
      const priority = supportPriorityRank(left) - supportPriorityRank(right)

      if (priority !== 0) {
        return priority
      }

      return Date.parse(right.updated_at ?? right.created_at) - Date.parse(left.updated_at ?? left.created_at)
    })[0]
}

function uniqueSupportRequests(requests: Tables<"support_requests">[]) {
  return Array.from(new Map(requests.map((request) => [request.id, request])).values())
}

function supportPriorityRank(request: Tables<"support_requests">) {
  if (request.priority === "urgent") {
    return 0
  }

  if (request.priority === "high") {
    return 1
  }

  if (request.status === "waiting_on_resident") {
    return 2
  }

  return 3
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function monthsAgoInput(months: number) {
  const date = new Date()
  date.setMonth(date.getMonth() - months)

  return date.toISOString().slice(0, 10)
}

const sourceIcon: Record<OperationsQueueSource, LucideIcon> = {
  admission: UserRoundPlus,
  payment: CreditCard,
  complaint: ShieldAlert,
  leave: CalendarCheck,
  onboarding: UserRoundCheck,
  notice: ClipboardList,
}
