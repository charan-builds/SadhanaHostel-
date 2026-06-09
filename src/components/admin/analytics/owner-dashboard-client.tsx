"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  IndianRupee,
  LifeBuoy,
  Loader2,
  Megaphone,
  ReceiptText,
  Users,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatCard } from "@/components/shared/stat-card"
import {
  MonthwiseDateRangeControls,
  type MonthwiseDateBasis,
} from "@/components/admin/analytics/monthwise-date-range-controls"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime, humanizeEnum } from "@/lib/format"
import {
  getMonthwiseQuickFilterRange,
  type MonthwiseDateRange,
  type MonthwiseQuickFilter,
} from "@/lib/monthwise-analytics"
import { useRealtimeOwnerAnalytics } from "@/lib/realtime"
import {
  useFinanceDashboard,
  useHostels,
  useLeaves,
  useNotices,
  useOwnerAnalytics,
  usePayments,
  useResidents,
  useSupportRequests,
} from "@/hooks"
import type { FinanceDashboard, FinanceTimelineEvent } from "@/lib/finance/finance-dashboard"
import { analyticsSdk, type OwnerAnalytics } from "@/sdk"
import type { Tables } from "@/types/database"

type ExportFormat = "csv" | "pdf"

type OwnerAction = {
  title: string
  detail: string
  href: string
  action: string
  icon: LucideIcon
  tone: "warning" | "info" | "success"
}

export function OwnerDashboardClient() {
  const { organizationId, session } = useAuth()
  const defaultHostelId = session?.hostelIds[0]
  const hostels = useHostels(Boolean(organizationId))
  const [hostelFilter, setHostelFilter] = useState(defaultHostelId ?? "all")
  const [quickFilter, setQuickFilter] =
    useState<MonthwiseQuickFilter>("last-6-months")
  const [range, setRange] = useState<MonthwiseDateRange>(() =>
    getMonthwiseQuickFilterRange("last-6-months")
  )
  const dateBasis: MonthwiseDateBasis = "revenue"
  const [downloading, setDownloading] = useState<ExportFormat | null>(null)
  const hostelId = hostelFilter === "all" ? defaultHostelId : hostelFilter
  const fromDate = range.fromDate
  const toDate = range.toDate
  const invalidDateRange = fromDate > toDate
  const ownerAnalytics = useOwnerAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
    fromDate,
    toDate,
  })
  const financeDashboard = useFinanceDashboard(
    organizationId
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const pendingPayments = usePayments({
    organizationId: organizationId ?? "",
    hostelId,
    status: "pending",
    fromDate,
    toDate,
    dateBasis: "activity",
    page: 1,
    pageSize: 5,
  })
  const residents = useResidents({
    organizationId: organizationId ?? "",
    hostelId,
    fromDate,
    toDate,
    page: 1,
    pageSize: 5,
  })
  const leaves = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    fromDate,
    toDate,
    page: 1,
    pageSize: 5,
  })
  const notices = useNotices({
    organizationId: organizationId ?? "",
    hostelId,
    activeOnly: true,
    fromDate,
    toDate,
    page: 1,
    pageSize: 5,
  })
  const supportRequests = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    status: "open",
    fromDate,
    toDate,
    page: 1,
    pageSize: 5,
  })
  const residentReports = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    status: "open",
    workflow: "resident_report",
    fromDate,
    toDate,
    page: 1,
    pageSize: 5,
  })

  useRealtimeOwnerAnalytics({ enabled: Boolean(organizationId) })

  const selectedHostelLabel = useMemo(() => {
    if (hostelFilter === "all") {
      return "Sadhana Boys Hostel"
    }

    return hostels.data?.find((hostel) => hostel.id === hostelFilter)?.name ?? "Selected hostel"
  }, [hostelFilter, hostels.data])
  const showHostelFilter = (hostels.data?.length ?? 0) > 1

  async function download(format: ExportFormat) {
    if (!organizationId) {
      return
    }

    setDownloading(format)

    try {
      const result = await analyticsSdk.downloadOwner({
        organizationId,
        hostelId,
        fromDate,
        toDate,
        format,
      })
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("Owner analytics export started.")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Owner analytics export failed."
      )
    } finally {
      setDownloading(null)
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

  if (ownerAnalytics.isLoading) {
    return <LoadingState variant="dashboard" />
  }

  if (ownerAnalytics.isError) {
    return (
      <APIErrorState
        title="Owner dashboard failed to load"
        error={ownerAnalytics.error}
        onRetry={() => void ownerAnalytics.refetch()}
      />
    )
  }

  const data = ownerAnalytics.data
  const finance = financeDashboard.data
  const selectedHostel =
    hostelFilter === "all"
      ? hostels.data?.find((hostel) => hostel.id === defaultHostelId) ?? hostels.data?.[0]
      : hostels.data?.find((hostel) => hostel.id === hostelFilter)

  if (!data) {
    return (
      <EmptyState
        title="Analytics are not ready"
        message="Add residents, payments, and dues to start seeing owner insights."
      />
    )
  }
  const collectionTarget = finance?.kpis.expectedCollection
    ? Math.round(((finance.owner.summary.revenue ?? data.summary.revenue) / finance.kpis.expectedCollection) * 100)
    : data.summary.paymentConversion
  const totalCapacity = selectedHostel?.capacity ?? 0
  const occupiedBeds = data.summary.activeResidents
  const availableBeds = Math.max(totalCapacity - occupiedBeds, 0)
  const occupancyRate = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0
  const supportTotal = supportRequests.data?.meta.total ?? 0
  const residentReportTotal = residentReports.data?.meta.total ?? 0
  const pendingPaymentTotal = pendingPayments.data?.meta.total ?? 0
  const actionCount = countOwnerActions({
    pendingCollection: finance?.kpis.pendingAmount ?? data.summary.pendingDues,
    overdueCollection: finance?.kpis.overdueAmount ?? 0,
    residentsPending: finance?.kpis.residentsWithPending ?? data.summary.unpaidResidents,
    dueTodayCount: finance?.dueWindows.todayCount ?? 0,
    onboardingPending: Object.values(data.onboarding.pending).reduce(
      (total, count) => total + count,
      0
    ),
    supportTotal,
    pendingPaymentTotal,
    unreadNotices: data.communications.unreadNotices,
    noticeAcknowledgementPending:
      data.communications.noticeAcknowledgementRates.pending,
  })
  const ownerActions = buildOwnerActions({
    pendingCollection: finance?.kpis.pendingAmount ?? data.summary.pendingDues,
    overdueCollection: finance?.kpis.overdueAmount ?? 0,
    residentsPending: finance?.kpis.residentsWithPending ?? data.summary.unpaidResidents,
    dueTodayCount: finance?.dueWindows.todayCount ?? 0,
    onboardingPending: Object.values(data.onboarding.pending).reduce(
      (total, count) => total + count,
      0
    ),
    supportTotal,
    pendingPaymentTotal,
    unreadNotices: data.communications.unreadNotices,
    noticeAcknowledgementPending:
      data.communications.noticeAcknowledgementRates.pending,
  })

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Owner Dashboard"
        description="Business intelligence for revenue, dues, resident access, and payment risk."
        badge={selectedHostelLabel}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(downloading)}
              onClick={() => void download("csv")}
            >
              {downloading === "csv" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              CSV
            </Button>
            <Button
              type="button"
              disabled={Boolean(downloading)}
              onClick={() => void download("pdf")}
            >
              {downloading === "pdf" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              PDF
            </Button>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Hostel Scope</CardTitle>
            <CardDescription>{selectedHostelLabel}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="owner-hostel-filter">Hostel</Label>
              {showHostelFilter ? (
                <Select value={hostelFilter} onValueChange={setHostelFilter}>
                  <SelectTrigger id="owner-hostel-filter" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hostels.data?.map((hostel) => (
                      <SelectItem key={hostel.id} value={hostel.id}>
                        {hostel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="owner-hostel-filter" value={selectedHostelLabel} readOnly />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={invalidDateRange}
              onClick={() => void ownerAnalytics.refetch()}
            >
              <BarChart3 className="size-4" aria-hidden="true" />
              Refresh analysis
            </Button>
          </CardContent>
        </Card>

        <MonthwiseDateRangeControls
          title="Monthwise Analytics"
          description="Select a month or range for revenue, collections, dues, occupancy, admissions, complaints, notices, and resident activity."
          range={range}
          quickFilter={quickFilter}
          onRangeChange={setRange}
          onQuickFilterChange={setQuickFilter}
          dateBasis={dateBasis}
          invalid={invalidDateRange}
        />
      </section>

      <OwnerHealthBrief
        collectionTarget={collectionTarget}
        todayRevenue={finance?.owner.summary.todayRevenue ?? 0}
        pendingCollection={finance?.kpis.pendingAmount ?? data.summary.pendingDues}
        overdueCollection={finance?.kpis.overdueAmount ?? 0}
        activeResidents={data.summary.activeResidents}
        occupancyRate={occupancyRate}
        actionCount={actionCount}
      />

      <OwnerDailyDigest
        todayRevenue={finance?.owner.summary.todayRevenue ?? 0}
        pendingCollection={finance?.kpis.pendingAmount ?? data.summary.pendingDues}
        overdueCollection={finance?.kpis.overdueAmount ?? 0}
        occupancyRate={occupancyRate}
        totalCapacity={totalCapacity}
        availableBeds={availableBeds}
        pendingPaymentTotal={pendingPaymentTotal}
        unreadNotices={data.communications.unreadNotices}
        noticeAcknowledgementPending={
          data.communications.noticeAcknowledgementRates.pending
        }
        supportTotal={supportTotal}
        residentReportTotal={residentReportTotal}
      />

      <OwnerForecastPanel
        data={data}
        occupancyRate={occupancyRate}
        totalCapacity={totalCapacity}
        availableBeds={availableBeds}
        pendingPaymentTotal={pendingPaymentTotal}
        noticeAcknowledgementPending={
          data.communications.noticeAcknowledgementRates.pending
        }
        supportTotal={supportTotal}
        residentReportTotal={residentReportTotal}
      />

      <OwnerDecisionQueue actions={ownerActions} />

      <DailyHealthKpis
        todayRevenue={finance?.owner.summary.todayRevenue ?? 0}
        pendingCollection={finance?.kpis.pendingAmount ?? data.summary.pendingDues}
        residentsWithPending={finance?.kpis.residentsWithPending ?? data.summary.unpaidResidents}
        occupancyRate={occupancyRate}
        occupiedBeds={occupiedBeds}
        totalCapacity={totalCapacity}
        actionCount={actionCount}
      />

      <MonthwiseHistoricalPanel trends={data.trends} />

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <MoneyControlCenter
          finance={finance}
          data={data}
          pendingPaymentTotal={pendingPaymentTotal}
          pendingPaymentsLoading={pendingPayments.isLoading}
          pendingPaymentRows={pendingPayments.data?.data ?? []}
        />
        <Card>
          <CardHeader>
            <CardTitle>Recent Collections</CardTitle>
            <CardDescription>Latest verified payments from Finance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(finance?.recentPayments ?? []).slice(0, 5).length === 0 ? (
              <EmptyState title="No recent collections" message="Verified payments will appear here." />
            ) : (
              (finance?.recentPayments ?? []).slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{humanizeEnum(payment.method)}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.verified_at ?? payment.created_at}
                    </p>
                  </div>
                  <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ResidentLifecycleFunnel
          data={data}
          totalCapacity={totalCapacity}
          occupiedBeds={occupiedBeds}
          availableBeds={availableBeds}
          occupancyRate={occupancyRate}
          residentsLoading={residents.isLoading}
          residents={residents.data?.data ?? []}
        />
        <CommunicationHealth
          data={data}
          noticesLoading={notices.isLoading}
          notices={notices.data?.data ?? []}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <ComplaintRisk
          supportLoading={supportRequests.isLoading || residentReports.isLoading}
          supportTotal={supportTotal}
          residentReportTotal={residentReportTotal}
          supportRows={supportRequests.data?.data ?? []}
          residentReportRows={residentReports.data?.data ?? []}
        />
        <ResidentActivity
          financeTimeline={finance?.timeline ?? []}
          leavesLoading={leaves.isLoading}
          leaves={leaves.data?.data ?? []}
          residents={residents.data?.data ?? []}
          residentsLoading={residents.isLoading}
        />
      </section>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>
              Monthly owner view across collections and billed dues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={data.trends}
              lines={[
                { key: "revenue", label: "Revenue", color: "#2563eb" },
                { key: "billed", label: "Billed", color: "#16a34a" },
                { key: "dues", label: "Dues", color: "#f59e0b" },
              ]}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Operational Insights</CardTitle>
            <CardDescription>
              Prioritized owner actions from dues, resident access, and payment signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.insights.length === 0 ? (
              <EmptyState
                title="No owner action needed"
                message="No finance or resident-access risks are currently detected."
              />
            ) : null}
            {data.insights.map((insight) => (
              <article key={`${insight.severity}-${insight.title}`} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={insight.severity === "critical" ? "destructive" : "secondary"}>
                    {humanizeEnum(insight.severity)}
                  </Badge>
                  <h2 className="text-sm font-semibold">{insight.title}</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{insight.description}</p>
                <p className="mt-2 text-sm font-medium">{insight.action}</p>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dues Aging</CardTitle>
            <CardDescription>Outstanding balances by overdue age.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              data={data.duesAging.map((item) => ({
                label: item.label,
                value: item.amount,
                detail: `${item.records} records`,
              }))}
              formatValue={formatCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resident Verification</CardTitle>
            <CardDescription>
              Verification health for residents in the selected scope.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DonutMetric
              value={data.onboarding.completed}
              total={data.onboarding.totalResidents}
              label={`${data.onboarding.completionRate}% verified`}
            />
            <div className="mt-4 grid gap-2">
              {Object.entries(data.onboarding.pending).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{humanizeEnum(status)}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </ResponsiveContainer>
  )
}

function TrendChart({
  data,
  lines,
}: {
  data: OwnerAnalytics["trends"]
  lines: Array<{ key: keyof OwnerAnalytics["trends"][number]; label: string; color: string }>
}) {
  const width = 720
  const height = 260
  const padding = 28
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) =>
      lines.map((line) => Number(item[line.key] ?? 0))
    )
  )
  const xFor = (index: number) =>
    padding + (index * (width - padding * 2)) / Math.max(1, data.length - 1)
  const yFor = (value: number) =>
    height - padding - (value / maxValue) * (height - padding * 2)

  if (data.length === 0) {
    return <EmptyState title="No trend data yet" message="Monthly analytics will appear after operational records exist." />
  }

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Owner trend chart"
        viewBox={`0 0 ${width} ${height}`}
        className="min-h-64 w-full min-w-[640px]"
      >
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="#e5e7eb" />
        {lines.map((line) => {
          const points = data
            .map((item, index) => `${xFor(index)},${yFor(Number(item[line.key] ?? 0))}`)
            .join(" ")

          return (
            <g key={String(line.key)}>
              <polyline
                fill="none"
                stroke={line.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
              {data.map((item, index) => {
                const value = Number(item[line.key] ?? 0)
                const x = xFor(index)
                const y = yFor(value)

                return (
                  <g key={`${String(line.key)}-${item.month}`}>
                    <circle cx={x} cy={y} r="5" fill={line.color} />
                  </g>
                )
              })}
            </g>
          )
        })}
        {data.map((item, index) => (
          <text key={item.month} x={xFor(index)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {item.month.slice(5)}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3">
        {lines.map((line) => (
          <span key={String(line.key)} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-3 rounded-full" style={{ backgroundColor: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((item) => (
          <div key={item.month} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{item.month}</p>
            <div className="mt-2 grid gap-1 text-muted-foreground">
              {lines.map((line) => (
                <div key={String(line.key)} className="flex items-center justify-between gap-3">
                  <span>{line.label}</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(Number(item[line.key] ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthwiseHistoricalPanel({
  trends,
}: {
  trends: OwnerAnalytics["trends"]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthwise Historical Analysis</CardTitle>
        <CardDescription>
          Revenue, collections, dues, occupancy, admissions, complaints, notices, and resident activity from real platform records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <EmptyState
            title="No monthwise history"
            message="Historical analytics appear after payments, residents, notices, support requests, or allocations exist in the selected range."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {trends.map((trend) => (
              <article key={trend.month} className="rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{formatMonthLabel(trend.month)}</h2>
                    <p className="text-sm text-muted-foreground">
                      {trend.occupancyRate}% occupied · {trend.residentActivity} resident events
                    </p>
                  </div>
                  <Badge variant="secondary">{trend.collectionCount} collections</Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <MonthMetric label="Revenue" value={formatCurrency(trend.revenue)} />
                  <MonthMetric
                    label="Collections"
                    value={formatCurrency(trend.collectionAmount)}
                    detail={`${trend.collectionCount} verified`}
                  />
                  <MonthMetric
                    label="Outstanding dues"
                    value={formatCurrency(trend.outstandingDues)}
                  />
                  <MonthMetric
                    label="Occupancy"
                    value={`${trend.occupancyRate}%`}
                    detail={`${trend.occupancyResidents}/${trend.capacity || 0} capacity`}
                  />
                  <MonthMetric
                    label="Admissions"
                    value={trend.admissions}
                    detail={`${trend.admissionInquiries} inquiries`}
                  />
                  <MonthMetric
                    label="Complaints"
                    value={trend.complaints}
                    detail={`${trend.openComplaints} open`}
                  />
                  <MonthMetric
                    label="Notice engagement"
                    value={trend.noticeEngagement}
                    detail={`${trend.noticeReads} reads, ${trend.noticeAcknowledgements} acknowledgements`}
                  />
                  <MonthMetric
                    label="Resident activity"
                    value={trend.residentActivity}
                    detail={`${trend.paymentSubmissions} payments, ${trend.leaveRequests} leaves`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MonthMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <div className="rounded-lg border bg-white/70 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  )
}

function OwnerHealthBrief({
  collectionTarget,
  todayRevenue,
  pendingCollection,
  overdueCollection,
  activeResidents,
  occupancyRate,
  actionCount,
}: {
  collectionTarget: number
  todayRevenue: number
  pendingCollection: number
  overdueCollection: number
  activeResidents: number
  occupancyRate: number
  actionCount: number
}) {
  const isHealthy = overdueCollection <= 0 && pendingCollection <= 0
  const verdict = isHealthy
    ? "Healthy today"
    : overdueCollection > 0
      ? "Collection risk"
      : "Follow-up needed"

  return (
    <Card className={isHealthy ? "border-success/25 bg-success-surface/70" : "border-warning/25 bg-warning-surface/70"}>
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_1.5fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isHealthy ? "secondary" : "destructive"}>{verdict}</Badge>
            <Badge variant="secondary">{activeResidents} active residents</Badge>
            <Badge variant="secondary">{occupancyRate}% occupied</Badge>
            <Badge variant={actionCount > 0 ? "destructive" : "secondary"}>
              {actionCount} actions
            </Badge>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            {isHealthy ? "Money and operations are clear." : "Owner action is needed today."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This panel converts finance signals into a simple owner decision before exports,
            charts, or detailed filters.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OwnerMiniMetric
            label="Today collected"
            value={formatCurrency(todayRevenue)}
            detail="Verified today"
          />
          <OwnerMiniMetric
            label="Collection rate"
            value={`${Math.max(0, Math.min(100, collectionTarget))}%`}
            detail="Against expected billing"
          />
          <OwnerMiniMetric
            label="Overdue"
            value={formatCurrency(overdueCollection)}
            detail={pendingCollection > 0 ? `${formatCurrency(pendingCollection)} pending` : "No pending dues"}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function OwnerDecisionQueue({
  actions,
}: {
  actions: OwnerAction[]
}) {
  if (actions.length === 0) {
    return (
      <Card className="border-success/25">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold">No owner action needed</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Collections, overdue dues, verification, and resident access look clear.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={"/admin/reports" as Route}>Open reports</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const primaryAction = actions[0]
  const secondaryActions = actions.slice(1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Owner Action Queue</CardTitle>
        <CardDescription>
          Highest-value actions based on collection, verification, and resident lifecycle signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-primary">
            Top owner action
          </p>
          <OwnerActionCard action={primaryAction} emphasis="primary" />
        </div>

        {secondaryActions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {secondaryActions.map((item) => (
              <OwnerActionCard key={`${item.href}-${item.title}`} action={item} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function OwnerDailyDigest({
  todayRevenue,
  pendingCollection,
  overdueCollection,
  occupancyRate,
  totalCapacity,
  availableBeds,
  pendingPaymentTotal,
  unreadNotices,
  noticeAcknowledgementPending,
  supportTotal,
  residentReportTotal,
}: {
  todayRevenue: number
  pendingCollection: number
  overdueCollection: number
  occupancyRate: number
  totalCapacity: number
  availableBeds: number
  pendingPaymentTotal: number
  unreadNotices: number
  noticeAcknowledgementPending: number
  supportTotal: number
  residentReportTotal: number
}) {
  const digestItems = [
    {
      label: "Money",
      headline:
        overdueCollection > 0
          ? `${formatCurrency(overdueCollection)} overdue`
          : pendingCollection > 0
            ? `${formatCurrency(pendingCollection)} pending`
            : `${formatCurrency(todayRevenue)} collected today`,
      detail:
        pendingPaymentTotal > 0
          ? `${pendingPaymentTotal} payment proof${pendingPaymentTotal === 1 ? "" : "s"} to verify`
          : "No payment proof is waiting",
      href: "/admin/finance/collections",
      cta: pendingPaymentTotal > 0 ? "Verify payments" : "Open collections",
    },
    {
      label: "Occupancy",
      headline: totalCapacity > 0 ? `${occupancyRate}% occupied` : "Capacity not set",
      detail:
        totalCapacity > 0
          ? `${availableBeds} bed${availableBeds === 1 ? "" : "s"} available`
          : "Set hostel capacity to unlock occupancy health",
      href: "/admin/residents",
      cta: "Review residents",
    },
    {
      label: "Communication",
      headline:
        noticeAcknowledgementPending > 0
          ? `${noticeAcknowledgementPending} acknowledgements pending`
          : unreadNotices > 0
            ? `${unreadNotices} unread notice${unreadNotices === 1 ? "" : "s"}`
            : "Notices clear",
      detail: "Review notice reach and publish follow-ups when needed",
      href: "/admin/notices",
      cta: "Review notices",
    },
    {
      label: "Support",
      headline:
        supportTotal + residentReportTotal > 0
          ? `${supportTotal + residentReportTotal} open item${supportTotal + residentReportTotal === 1 ? "" : "s"}`
          : "Support clear",
      detail:
        residentReportTotal > 0
          ? `${residentReportTotal} resident report${residentReportTotal === 1 ? "" : "s"} open`
          : "Complaints and resident reports are clear",
      href: "/admin/alerts",
      cta: "Open support",
    },
  ] as const

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Daily Owner Digest</CardTitle>
            <CardDescription>
              What requires attention today across money, occupancy, communication, and support.
            </CardDescription>
          </div>
          <Badge variant="secondary">Today</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {digestItems.map((item) => (
          <div key={item.label} className="rounded-xl border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {item.label}
            </p>
            <h3 className="mt-3 text-base font-semibold">{item.headline}</h3>
            <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {item.detail}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4 w-full">
              <Link href={item.href as Route}>
                {item.cta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function OwnerActionCard({
  action,
  emphasis = "default",
}: {
  action: OwnerAction
  emphasis?: "default" | "primary"
}) {
  const Icon = action.icon

  return (
    <Link
      href={action.href as Route}
      className={`group rounded-xl border p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted ${
        emphasis === "primary" ? "bg-background" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <Badge variant={action.tone === "warning" ? "destructive" : "secondary"}>
          {humanizeEnum(action.tone)}
        </Badge>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{action.title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{action.detail}</p>
      <p className="mt-3 text-xs font-semibold text-primary">{action.action}</p>
    </Link>
  )
}

function OwnerForecastPanel({
  data,
  occupancyRate,
  totalCapacity,
  availableBeds,
  pendingPaymentTotal,
  noticeAcknowledgementPending,
  supportTotal,
  residentReportTotal,
}: {
  data: OwnerAnalytics
  occupancyRate: number
  totalCapacity: number
  availableBeds: number
  pendingPaymentTotal: number
  noticeAcknowledgementPending: number
  supportTotal: number
  residentReportTotal: number
}) {
  const forecast = data.forecasts.revenue
  const collectionRisk =
    forecast.expectedCollectionRate < 85 || forecast.riskAdjustedPendingDues > 0
  const occupancyRisk =
    totalCapacity <= 0
      ? "Capacity setup needed"
      : occupancyRate < 70
        ? "Occupancy risk"
        : occupancyRate >= 95
          ? "Near full"
          : "Stable occupancy"
  const recommendations = [
    collectionRisk
      ? {
          title: "Follow up revenue risk",
          detail: `${formatCurrency(forecast.riskAdjustedPendingDues)} risk-adjusted dues`,
          href: "/admin/finance/followups",
        }
      : null,
    pendingPaymentTotal > 0
      ? {
          title: "Verify payment proofs",
          detail: `${pendingPaymentTotal} proof${pendingPaymentTotal === 1 ? "" : "s"} waiting`,
          href: "/admin/payments",
        }
      : null,
    totalCapacity > 0 && occupancyRate < 80
      ? {
          title: "Improve occupancy",
          detail: `${availableBeds} bed${availableBeds === 1 ? "" : "s"} available`,
          href: "/admin/residents",
        }
      : null,
    noticeAcknowledgementPending > 0
      ? {
          title: "Close notice acknowledgement gap",
          detail: `${noticeAcknowledgementPending} acknowledgement${noticeAcknowledgementPending === 1 ? "" : "s"} pending`,
          href: "/admin/notices",
        }
      : null,
    supportTotal + residentReportTotal > 0
      ? {
          title: "Reduce complaint risk",
          detail: `${supportTotal + residentReportTotal} support item${supportTotal + residentReportTotal === 1 ? "" : "s"} open`,
          href: "/admin/alerts",
        }
      : null,
  ].filter((item): item is { title: string; detail: string; href: string } => Boolean(item))

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Forecast and Risk Alerts</CardTitle>
            <CardDescription>
              Revenue forecast, occupancy forecast, and recommended owner actions.
            </CardDescription>
          </div>
          <Badge variant={collectionRisk ? "destructive" : "secondary"}>
            {collectionRisk ? "Revenue risk" : "Forecast stable"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OwnerMiniMetric
            label="Expected billing"
            value={formatCurrency(forecast.nextMonthExpectedBilling)}
            detail="Next month forecast"
          />
          <OwnerMiniMetric
            label="Expected collection"
            value={`${forecast.expectedCollectionRate}%`}
            detail={formatCurrency(forecast.expectedCollectedRevenue)}
          />
          <OwnerMiniMetric
            label="Risk-adjusted dues"
            value={formatCurrency(forecast.riskAdjustedPendingDues)}
            detail={collectionRisk ? "Needs follow-up" : "No forecast risk"}
          />
          <OwnerMiniMetric
            label="Occupancy forecast"
            value={totalCapacity > 0 ? `${occupancyRate}%` : "Not set"}
            detail={occupancyRisk}
          />
        </div>

        <div className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Recommended owner actions</h3>
            <Badge variant={recommendations.length > 0 ? "destructive" : "secondary"}>
              {recommendations.length}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2">
            {recommendations.length === 0 ? (
              <p className="rounded-lg border border-success/25 bg-success-surface px-3 py-2 text-sm text-success-foreground">
                Forecasts look stable. Keep monitoring collections and occupancy.
              </p>
            ) : (
              recommendations.slice(0, 4).map((item) => (
                <Button
                  key={item.title}
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-auto justify-between gap-3 py-2 text-left"
                >
                  <Link href={item.href as Route}>
                    <span>
                      <span className="block font-medium">{item.title}</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                </Button>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DailyHealthKpis({
  todayRevenue,
  pendingCollection,
  residentsWithPending,
  occupancyRate,
  occupiedBeds,
  totalCapacity,
  actionCount,
}: {
  todayRevenue: number
  pendingCollection: number
  residentsWithPending: number
  occupancyRate: number
  occupiedBeds: number
  totalCapacity: number
  actionCount: number
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Cash Collected Today"
        value={formatCurrency(todayRevenue)}
        description="Verified owner-facing collections today"
        icon={IndianRupee}
        tone="success"
      />
      <StatCard
        title="Pending Collection"
        value={formatCurrency(pendingCollection)}
        description={`${residentsWithPending} resident${residentsWithPending === 1 ? "" : "s"} pending`}
        icon={AlertTriangle}
        tone={pendingCollection > 0 ? "warning" : "success"}
      />
      <StatCard
        title="Occupancy"
        value={totalCapacity > 0 ? `${occupancyRate}%` : "Not set"}
        description={
          totalCapacity > 0
            ? `${occupiedBeds}/${totalCapacity} student capacity occupied`
            : "Configure hostel capacity to show occupancy"
        }
        icon={Users}
        tone="info"
      />
      <StatCard
        title="Action Queue"
        value={actionCount}
        description={actionCount > 0 ? "Owner actions waiting" : "No urgent owner action"}
        icon={ClipboardList}
        tone={actionCount > 0 ? "warning" : "success"}
      />
    </section>
  )
}

function MoneyControlCenter({
  finance,
  data,
  pendingPaymentTotal,
  pendingPaymentsLoading,
  pendingPaymentRows,
}: {
  finance: FinanceDashboard | undefined
  data: OwnerAnalytics
  pendingPaymentTotal: number
  pendingPaymentsLoading: boolean
  pendingPaymentRows: Tables<"payments">[]
}) {
  const pendingCollection = finance?.kpis.pendingAmount ?? data.summary.pendingDues
  const overdueCollection = finance?.kpis.overdueAmount ?? 0
  const collectionRate = finance?.kpis.collectionRate ?? data.summary.paymentConversion

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Money Control Center</CardTitle>
            <CardDescription>
              What is collected, what is stuck, and which money action comes next.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={"/admin/finance/collections" as Route}>Open collections</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <OwnerMiniMetric
            label="This month collected"
            value={formatCurrency(finance?.owner.summary.revenue ?? data.summary.revenue)}
            detail={`${collectionRate}% collection rate`}
          />
          <OwnerMiniMetric
            label="Pending dues"
            value={formatCurrency(pendingCollection)}
            detail={`${finance?.kpis.residentsWithPending ?? data.summary.unpaidResidents} residents pending`}
          />
          <OwnerMiniMetric
            label="Overdue"
            value={formatCurrency(overdueCollection)}
            detail={`${finance?.owner.highRisk.overdue30Plus ?? 0} residents 30+ days`}
          />
          <OwnerMiniMetric
            label="Payment proofs"
            value={pendingPaymentTotal}
            detail="Waiting for verification"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Collection progress</span>
            <span className="text-muted-foreground">{Math.max(0, Math.min(100, collectionRate))}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(0, Math.min(100, collectionRate))}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Payment verification queue</h3>
            <Badge variant={pendingPaymentTotal > 0 ? "destructive" : "secondary"}>
              {pendingPaymentTotal}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2">
            {pendingPaymentsLoading ? (
              <LoadingState variant="cards" rows={1} />
            ) : pendingPaymentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending payment proof is waiting.</p>
            ) : (
              pendingPaymentRows.slice(0, 3).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{payment.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(payment.created_at)}</p>
                  </div>
                  <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={"/admin/payments" as Route}>Verify proof</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={"/admin/finance/followups" as Route}>Follow up dues</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ResidentLifecycleFunnel({
  data,
  totalCapacity,
  occupiedBeds,
  availableBeds,
  occupancyRate,
  residentsLoading,
  residents,
}: {
  data: OwnerAnalytics
  totalCapacity: number
  occupiedBeds: number
  availableBeds: number
  occupancyRate: number
  residentsLoading: boolean
  residents: Tables<"residents">[]
}) {
  const leadCount = sumTrend(data.trends, "reservations")
  const newResidents = sumTrend(data.trends, "newResidents")
  const checkedOut = sumTrend(data.trends, "churnedResidents")
  const pendingOnboarding = Object.entries(data.onboarding.pending)
  const funnel = [
    { label: "Leads / reservations", value: leadCount, href: "/admin/reservations" },
    { label: "New residents", value: newResidents, href: "/admin/residents" },
    { label: "Pending access", value: pendingOnboarding.reduce((total, [, count]) => total + count, 0), href: "/admin/residents" },
    { label: "Active residents", value: data.summary.activeResidents, href: "/admin/residents" },
    { label: "Checked out", value: checkedOut, href: "/admin/residents" },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Resident Lifecycle & Occupancy</CardTitle>
            <CardDescription>
              Resident flow from lead to active occupancy, with current capacity.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={"/admin/residents/new" as Route}>Add resident</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <OwnerMiniMetric
            label="Occupied"
            value={totalCapacity > 0 ? `${occupiedBeds}/${totalCapacity}` : occupiedBeds}
            detail={`${occupancyRate}% occupied`}
          />
          <OwnerMiniMetric
            label="Available capacity"
            value={totalCapacity > 0 ? availableBeds : "Not set"}
            detail="Student capacity remaining"
          />
          <OwnerMiniMetric
            label="Billing residents"
            value={data.summary.billingResidents}
            detail={`${data.summary.activeResidents} active`}
          />
        </div>
        <div className="grid gap-2">
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-info"
              style={{ width: `${Math.max(0, Math.min(100, occupancyRate))}%` }}
            />
          </div>
        </div>
        <div className="grid gap-2">
          {funnel.map((item) => (
            <Link
              key={item.label}
              href={item.href as Route}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition hover:bg-muted/40"
            >
              <span>{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </Link>
          ))}
        </div>
        <div className="rounded-xl border bg-background/70 p-3">
          <h3 className="text-sm font-semibold">Recent resident activity</h3>
          <div className="mt-3 grid gap-2">
            {residentsLoading ? (
              <LoadingState variant="cards" rows={1} />
            ) : residents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resident records found in this scope.</p>
            ) : (
              residents.slice(0, 3).map((resident) => (
                <div key={resident.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate font-medium">{resident.full_name}</span>
                  <Badge variant="outline">{humanizeEnum(resident.status)}</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CommunicationHealth({
  data,
  noticesLoading,
  notices,
}: {
  data: OwnerAnalytics
  noticesLoading: boolean
  notices: Tables<"notices">[]
}) {
  const readRate = data.communications.noticeReadRates.percentage
  const ackRate = data.communications.noticeAcknowledgementRates.percentage

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Communication Health</CardTitle>
            <CardDescription>
              Notice engagement, acknowledgement risk, and reminder read signal.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={"/admin/notices" as Route}>Publish notice</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <OwnerMiniMetric
            label="Notice read rate"
            value={`${readRate}%`}
            detail={`${data.communications.noticeReadRates.read}/${data.communications.noticeReadRates.totalRecipients} read`}
          />
          <OwnerMiniMetric
            label="Acknowledgement"
            value={`${ackRate}%`}
            detail={`${data.communications.noticeAcknowledgementRates.pending} pending`}
          />
          <OwnerMiniMetric
            label="Reminder engagement"
            value={`${data.communications.feeReminderEngagement.percentage}%`}
            detail={`${data.communications.feeReminderEngagement.read}/${data.communications.feeReminderEngagement.sent} read`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <EngagementBar label="Read rate" value={readRate} />
          <EngagementBar label="Acknowledgement" value={ackRate} />
        </div>
        <div className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Active notices</h3>
            <Badge variant={data.communications.unreadNotices > 0 ? "destructive" : "secondary"}>
              {data.communications.unreadNotices} unread notices
            </Badge>
          </div>
          <div className="mt-3 grid gap-2">
            {noticesLoading ? (
              <LoadingState variant="cards" rows={1} />
            ) : notices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active notices are currently published.</p>
            ) : (
              notices.slice(0, 3).map((notice) => (
                <Link
                  key={notice.id}
                  href={"/admin/notices" as Route}
                  className="rounded-lg border px-3 py-2 text-sm transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{notice.title}</span>
                    <Badge variant="outline">{humanizeEnum(notice.status)}</Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ComplaintRisk({
  supportLoading,
  supportTotal,
  residentReportTotal,
  supportRows,
  residentReportRows,
}: {
  supportLoading: boolean
  supportTotal: number
  residentReportTotal: number
  supportRows: Tables<"support_requests">[]
  residentReportRows: Tables<"support_requests">[]
}) {
  const urgentCount = supportRows.filter((request) => request.priority === "urgent").length
  const visibleRows = residentReportRows.length > 0 ? residentReportRows : supportRows

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Complaint & Support Risk</CardTitle>
            <CardDescription>
              Open resident issues, maintenance/safety reports, and support pressure.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={"/admin/alerts" as Route}>Open support</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <OwnerMiniMetric label="Open support" value={supportTotal} detail="All categories" />
          <OwnerMiniMetric label="Resident reports" value={residentReportTotal} detail="Maintenance, safety, lost/found" />
          <OwnerMiniMetric label="Urgent shown" value={urgentCount} detail="From current page" />
        </div>
        <div className="grid gap-2">
          {supportLoading ? (
            <LoadingState variant="cards" rows={2} />
          ) : visibleRows.length === 0 ? (
            <EmptyState title="No open complaints" message="Resident support requests will appear here." />
          ) : (
            visibleRows.slice(0, 4).map((request) => (
              <Link
                key={request.id}
                href={"/admin/alerts" as Route}
                className="rounded-lg border p-3 text-sm transition hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{request.subject}</span>
                  <Badge variant={request.priority === "urgent" ? "destructive" : "secondary"}>
                    {humanizeEnum(request.priority)}
                  </Badge>
                  <Badge variant="outline">{humanizeEnum(request.status)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {humanizeEnum(request.category)} · {formatDateTime(request.created_at)}
                </p>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ResidentActivity({
  financeTimeline,
  leavesLoading,
  leaves,
  residents,
  residentsLoading,
}: {
  financeTimeline: FinanceTimelineEvent[]
  leavesLoading: boolean
  leaves: Tables<"leave_requests">[]
  residents: Tables<"residents">[]
  residentsLoading: boolean
}) {
  const activity = [
    ...financeTimeline.slice(0, 4).map((event) => ({
      id: event.id,
      title: event.title,
      detail: event.description,
      date: event.occurredAt,
      href: "/admin/finance" as Route,
      icon: ReceiptText,
    })),
    ...leaves.slice(0, 3).map((leave) => ({
      id: leave.id,
      title: `Leave ${humanizeEnum(leave.status)}`,
      detail: `${leave.from_date} to ${leave.to_date}`,
      date: leave.created_at,
      href: "/admin/leaves" as Route,
      icon: CalendarDays,
    })),
    ...residents.slice(0, 3).map((resident) => ({
      id: resident.id,
      title: resident.full_name,
      detail: humanizeEnum(resident.status),
      date: resident.updated_at,
      href: `/admin/residents/${resident.id}` as Route,
      icon: Users,
    })),
  ]
    .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
    .slice(0, 7)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Resident Activity</CardTitle>
            <CardDescription>
              Latest finance, leave, and resident lifecycle changes.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={"/admin/residents" as Route}>Open residents</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {leavesLoading || residentsLoading ? (
          <LoadingState variant="cards" rows={3} />
        ) : activity.length === 0 ? (
          <EmptyState title="No resident activity yet" message="Payments, leaves, and resident updates will appear here." />
        ) : (
          <div className="relative grid gap-3 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
            {activity.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={`${item.href}-${item.id}`}
                  href={item.href}
                  className="relative grid grid-cols-[2rem_1fr] gap-3 rounded-lg p-1 transition hover:bg-muted/40"
                >
                  <span className="relative z-10 flex size-8 items-center justify-center rounded-full border bg-background text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="rounded-lg border bg-background/70 p-3 text-sm">
                    <span className="block font-semibold">{item.title}</span>
                    <span className="mt-1 block text-muted-foreground">{item.detail}</span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {formatDateTime(item.date)}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EngagementBar({ label, value }: { label: string; value: number }) {
  const width = Math.max(0, Math.min(100, value))

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{width}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function DonutMetric({
  value,
  total,
  label,
}: {
  value: number
  total: number
  label: string
}) {
  const percentage = total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100))

  return (
    <div className="flex items-center gap-4">
      <div
        aria-label={`${percentage}%`}
        className="grid size-28 place-items-center rounded-full"
        style={{
          background: `conic-gradient(#2563eb ${percentage}%, #e5e7eb 0)`,
        }}
      >
        <div className="grid size-20 place-items-center rounded-full bg-background">
          <span className="text-xl font-semibold">{percentage}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium">
          {value} of {total}
        </p>
      </div>
    </div>
  )
}

function OwnerMiniMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function BarList({
  data,
  formatValue,
}: {
  data: Array<{ label: string; value: number; detail: string }>
  formatValue: (value: number) => string
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value))

  return (
    <div className="grid gap-3">
      {data.map((item) => (
        <div key={item.label} className="grid gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground">{formatValue(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)

  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function sumTrend(
  trends: OwnerAnalytics["trends"],
  key: "newResidents" | "churnedResidents" | "reservations"
) {
  return trends.reduce((total, item) => total + Number(item[key] ?? 0), 0)
}

function countOwnerActions(input: OwnerActionInput) {
  return buildOwnerActions(input).length
}

type OwnerActionInput = {
  pendingCollection: number
  overdueCollection: number
  residentsPending: number
  dueTodayCount: number
  onboardingPending: number
  supportTotal: number
  pendingPaymentTotal: number
  unreadNotices: number
  noticeAcknowledgementPending: number
}

function buildOwnerActions(input: OwnerActionInput) {
  const actions: OwnerAction[] = []

  if (input.pendingPaymentTotal > 0) {
    actions.push({
      title: "Payment proofs need verification",
      detail: `${input.pendingPaymentTotal} proof${input.pendingPaymentTotal === 1 ? "" : "s"} are waiting before dues can update.`,
      href: "/admin/payments",
      action: "Verify payment proof",
      icon: ReceiptText,
      tone: "warning",
    })
  }

  if (input.overdueCollection > 0) {
    actions.push({
      title: "Overdue collection needs follow-up",
      detail: `${formatCurrency(input.overdueCollection)} is past due across pending residents.`,
      href: "/admin/finance/collections",
      action: "Open collections",
      icon: AlertTriangle,
      tone: "warning",
    })
  }

  if (input.pendingCollection > 0) {
    actions.push({
      title: "Pending collection is visible",
      detail: `${formatCurrency(input.pendingCollection)} pending from ${input.residentsPending} resident${input.residentsPending === 1 ? "" : "s"}.`,
      href: "/admin/finance/followups",
      action: "Send follow-up",
      icon: Users,
      tone: "info",
    })
  }

  if (input.dueTodayCount > 0) {
    actions.push({
      title: "Residents are due today",
      detail: `${input.dueTodayCount} resident${input.dueTodayCount === 1 ? "" : "s"} have dues today.`,
      href: "/admin/finance/collections",
      action: "Review due today",
      icon: CalendarDays,
      tone: "info",
    })
  }

  if (input.onboardingPending > 0) {
    actions.push({
      title: "Resident access is incomplete",
      detail: `${input.onboardingPending} resident profile${input.onboardingPending === 1 ? "" : "s"} still need onboarding/verification action.`,
      href: "/admin/residents",
      action: "Open residents",
      icon: Users,
      tone: "info",
    })
  }

  if (input.supportTotal > 0) {
    actions.push({
      title: "Support requests are open",
      detail: `${input.supportTotal} support or complaint request${input.supportTotal === 1 ? "" : "s"} need review.`,
      href: "/admin/alerts",
      action: "Open support queue",
      icon: LifeBuoy,
      tone: "warning",
    })
  }

  if (input.unreadNotices > 0 || input.noticeAcknowledgementPending > 0) {
    actions.push({
      title: "Notice engagement needs follow-up",
      detail: `${input.unreadNotices} unread notice signal${input.unreadNotices === 1 ? "" : "s"} and ${input.noticeAcknowledgementPending} acknowledgement${input.noticeAcknowledgementPending === 1 ? "" : "s"} pending.`,
      href: "/admin/notices",
      action: "Review notices",
      icon: Megaphone,
      tone: "info",
    })
  }

  return actions.slice(0, 5)
}
