"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Download,
  IndianRupee,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatCard } from "@/components/shared/stat-card"
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
import { formatCurrency, humanizeEnum } from "@/lib/format"
import { useRealtimeOwnerAnalytics } from "@/lib/realtime"
import { useFinanceDashboard, useHostels, useOwnerAnalytics } from "@/hooks"
import { analyticsSdk, type OwnerAnalytics } from "@/sdk"

type ExportFormat = "csv" | "pdf"

export function OwnerDashboardClient() {
  const { organizationId, session } = useAuth()
  const defaultHostelId = session?.hostelIds[0]
  const hostels = useHostels(Boolean(organizationId))
  const [hostelFilter, setHostelFilter] = useState(defaultHostelId ?? "all")
  const [fromDate, setFromDate] = useState(() => monthsAgoInput(5))
  const [toDate, setToDate] = useState(() => todayInput())
  const [downloading, setDownloading] = useState<ExportFormat | null>(null)
  const hostelId = hostelFilter === "all" ? defaultHostelId : hostelFilter
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

  if (!data) {
    return (
      <EmptyState
        title="Analytics are not ready"
        message="Add residents, payments, and dues to start seeing owner insights."
      />
    )
  }

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

      <Card>
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="grid gap-2">
            <Label htmlFor="owner-from-date">From</Label>
            <Input
              id="owner-from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="owner-to-date">To</Label>
            <Input
              id="owner-to-date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void ownerAnalytics.refetch()}
            >
              <BarChart3 className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(finance?.owner.summary.todayRevenue ?? 0)}
          description="Verified collections today"
          icon={IndianRupee}
          tone="success"
        />
        <StatCard
          title="This Month Revenue"
          value={formatCurrency(finance?.owner.summary.revenue ?? data.summary.revenue)}
          description="Verified monthly collections"
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          title="Pending Collection"
          value={formatCurrency(finance?.kpis.pendingAmount ?? data.summary.pendingDues)}
          description={`${finance?.kpis.residentsWithPending ?? data.summary.unpaidResidents} residents pending`}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          title="Overdue Collection"
          value={formatCurrency(finance?.kpis.overdueAmount ?? 0)}
          description="Past due date balance"
          icon={AlertTriangle}
          tone={(finance?.kpis.overdueAmount ?? 0) > 0 ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Unread Notifications"
          value={data.communications.unreadNotifications}
          description={`${data.communications.unreadNotices} unread notice notifications`}
          icon={Bell}
          tone={data.communications.unreadNotifications > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Unread Residents"
          value={data.communications.unreadResidents}
          description="Residents with unread notification items"
          icon={Users}
          tone={data.communications.unreadResidents > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Overdue Residents"
          value={data.communications.overdueResidents}
          description="Residents with overdue fee balance"
          icon={AlertTriangle}
          tone={data.communications.overdueResidents > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Notice Read Rate"
          value={`${data.communications.noticeReadRates.percentage}%`}
          description={`${data.communications.noticeReadRates.read}/${data.communications.noticeReadRates.totalRecipients} recipients read`}
          icon={TrendingUp}
          tone={data.communications.noticeReadRates.percentage >= 75 ? "success" : "warning"}
        />
        <StatCard
          title="Acknowledgement Rate"
          value={`${data.communications.noticeAcknowledgementRates.percentage}%`}
          description={`${data.communications.noticeAcknowledgementRates.acknowledged}/${data.communications.noticeAcknowledgementRates.totalRecipients} acknowledged`}
          icon={TrendingUp}
          tone={
            data.communications.noticeAcknowledgementRates.percentage >= 75
              ? "success"
              : "warning"
          }
        />
        <StatCard
          title="Reminder Engagement"
          value={`${data.communications.feeReminderEngagement.percentage}%`}
          description={`${data.communications.feeReminderEngagement.read}/${data.communications.feeReminderEngagement.sent} reminders read`}
          icon={IndianRupee}
          tone={data.communications.feeReminderEngagement.percentage >= 60 ? "success" : "warning"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Owner Collection Pulse</CardTitle>
            <CardDescription>Daily hostel collection signals from Finance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <OwnerMiniMetric
              label="Residents Due Today"
              value={finance?.dueWindows.todayCount ?? 0}
              detail={formatCurrency(finance?.dueWindows.today ?? 0)}
            />
            <OwnerMiniMetric
              label="Due This Week"
              value={finance?.dueWindows.weekCount ?? 0}
              detail={formatCurrency(finance?.dueWindows.week ?? 0)}
            />
            <OwnerMiniMetric
              label="Notice Engagement"
              value={`${data.communications.noticeReadRates.percentage}%`}
              detail={`${data.communications.noticeReadRates.read}/${data.communications.noticeReadRates.totalRecipients} read`}
            />
            <OwnerMiniMetric
              label="Notification Engagement"
              value={`${data.communications.feeReminderEngagement.percentage}%`}
              detail={`${data.communications.feeReminderEngagement.read}/${data.communications.feeReminderEngagement.sent} reminders`}
            />
            <OwnerMiniMetric
              label="Collection Conversion"
              value={`${data.summary.paymentConversion}%`}
              detail="Submitted to verified"
            />
            <OwnerMiniMetric
              label="Cash Today"
              value={formatCurrency(finance?.owner.collectionToday.cash ?? 0)}
              detail="Counter collections"
            />
            <OwnerMiniMetric
              label="UPI + Bank Today"
              value={formatCurrency(
                (finance?.owner.collectionToday.upi ?? 0) +
                  (finance?.owner.collectionToday.bank ?? 0)
              )}
              detail="Digital collections"
            />
          </CardContent>
        </Card>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Residents"
          value={data.summary.activeResidents}
          description={`${data.summary.billingResidents} residents in billing`}
          icon={Users}
          tone="info"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(data.summary.revenue)}
          description={`${data.summary.paymentConversion}% payment conversion`}
          icon={IndianRupee}
          tone="success"
        />
        <StatCard
          title="Pending Dues"
          value={formatCurrency(data.summary.pendingDues)}
          description={`${data.summary.unpaidResidents} unpaid residents`}
          icon={AlertTriangle}
          tone={data.summary.pendingDues > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Growth"
          value={`${data.summary.monthlyGrowth}%`}
          description={`${data.summary.residentChurn}% resident churn`}
          icon={TrendingUp}
          tone={data.summary.monthlyGrowth >= 0 ? "info" : "warning"}
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

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function monthsAgoInput(months: number) {
  const date = new Date()
  date.setUTCMonth(date.getUTCMonth() - months)
  date.setUTCDate(1)

  return date.toISOString().slice(0, 10)
}
