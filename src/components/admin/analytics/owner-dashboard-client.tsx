"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CalendarDays,
  Download,
  IndianRupee,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserPlus,
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
import { useHostels, useOwnerAnalytics } from "@/hooks"
import {
  OWNER_PERIOD_PRESETS,
  formatOwnerExactRange,
  formatOwnerPeriodLabel,
  getOwnerPeriodRange,
  getPreviousOwnerPeriod,
  type OwnerPeriodPreset,
  type OwnerPeriodRange,
} from "@/lib/analytics/owner-period"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime, humanizeEnum } from "@/lib/format"
import { useRealtimeOwnerAnalytics } from "@/lib/realtime"
import { cn } from "@/lib/utils"
import { analyticsSdk, type OwnerAnalytics } from "@/sdk"

type ExportFormat = "csv" | "pdf"
type HealthStatus = "good" | "attention" | "critical"

export function OwnerDashboardClient() {
  const { organizationId } = useAuth()
  const hostels = useHostels(Boolean(organizationId))
  const [hostelFilter, setHostelFilter] = useState("all")
  const [preset, setPreset] = useState<OwnerPeriodPreset>("month")
  const [range, setRange] = useState<OwnerPeriodRange>(() =>
    getOwnerPeriodRange("month")
  )
  const [downloading, setDownloading] = useState<ExportFormat | null>(null)
  const [highlightRefresh, setHighlightRefresh] = useState(false)
  const lastCompletedScope = useRef<string | null>(null)
  const hostelId = hostelFilter === "all" ? undefined : hostelFilter
  const previousRange = useMemo(
    () => getPreviousOwnerPeriod(range, preset),
    [preset, range]
  )
  const ownerAnalytics = useOwnerAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
    ...range,
  })
  const previousAnalytics = useOwnerAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
    ...previousRange,
  })

  useRealtimeOwnerAnalytics({ enabled: Boolean(organizationId) })

  const selectedHostelLabel = useMemo(() => {
    if (hostelFilter === "all") {
      return (hostels.data?.length ?? 0) > 1
        ? "All Hostels"
        : hostels.data?.[0]?.name ?? "Sadhana Boys Hostel"
    }

    return (
      hostels.data?.find((hostel) => hostel.id === hostelFilter)?.name ??
      "Selected hostel"
    )
  }, [hostelFilter, hostels.data])
  const showHostelFilter = (hostels.data?.length ?? 0) > 1
  const viewingLabel = formatOwnerPeriodLabel(range, preset)
  const previousLabel = formatOwnerPeriodLabel(previousRange, "custom")
  const exactRangeLabel = formatOwnerExactRange(range)
  const refreshScope = `${hostelFilter}:${range.fromDate}:${range.toDate}`

  useEffect(() => {
    if (!ownerAnalytics.data || ownerAnalytics.isFetching) {
      return
    }

    if (
      lastCompletedScope.current &&
      lastCompletedScope.current !== refreshScope
    ) {
      toast.success(`Analytics updated for ${viewingLabel}`)
      setHighlightRefresh(true)
      const timeout = window.setTimeout(() => setHighlightRefresh(false), 1400)
      lastCompletedScope.current = refreshScope

      return () => window.clearTimeout(timeout)
    }

    lastCompletedScope.current = refreshScope
  }, [
    ownerAnalytics.data,
    ownerAnalytics.isFetching,
    refreshScope,
    viewingLabel,
  ])

  function selectPreset(nextPreset: OwnerPeriodPreset) {
    setPreset(nextPreset)

    if (nextPreset !== "custom") {
      setRange(getOwnerPeriodRange(nextPreset))
    }
  }

  async function download(format: ExportFormat) {
    if (!organizationId) {
      return
    }

    setDownloading(format)
    const toastId = toast.loading(
      `Exporting ${viewingLabel} report as ${format.toUpperCase()}...`
    )

    try {
      const result = await analyticsSdk.downloadOwner({
        organizationId,
        hostelId,
        ...range,
        format,
      })
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(`${viewingLabel} report download started.`, { id: toastId })
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Owner analytics export failed.",
        { id: toastId }
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
    return (
      <ResponsiveContainer size="wide" className="grid gap-4 px-0 sm:px-0">
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading analytics...
        </div>
        <LoadingState variant="dashboard" />
      </ResponsiveContainer>
    )
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
  const previous = previousAnalytics.data

  if (!data) {
    return (
      <EmptyState
        title="Analytics are not ready"
        message="Add residents, payments, and dues to start seeing owner insights."
      />
    )
  }

  const refreshing = ownerAnalytics.isFetching
  const exportDisabled = Boolean(downloading) || refreshing || !data.hasData

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Owner Dashboard"
        description="Period-specific business performance, health signals, and owner actions."
        badge={selectedHostelLabel}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={exportDisabled}
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
              disabled={exportDisabled}
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

      <section
        aria-labelledby="business-period-heading"
        className="border-y bg-muted/30 py-5"
      >
        <div className="grid gap-5 px-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2
                id="business-period-heading"
                className="text-base font-semibold"
              >
                Business Performance Period
              </h2>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-6">
                <p>
                  Viewing:{" "}
                  <strong className="font-semibold text-foreground">
                    {viewingLabel}
                  </strong>
                </p>
                <p>
                  Compared With:{" "}
                  <strong className="font-semibold text-foreground">
                    {previousLabel}
                  </strong>
                </p>
                <p>
                  Last Updated:{" "}
                  <strong className="font-semibold text-foreground">
                    {formatDateTime(data.generatedAt)}
                  </strong>
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => {
                void ownerAnalytics.refetch()
                void previousAnalytics.refetch()
              }}
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Refresh
            </Button>
          </div>

          <div
            className="flex flex-wrap gap-1 rounded-lg border bg-background p-1"
            aria-label="Analytics period presets"
          >
            {OWNER_PERIOD_PRESETS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={preset === option.value ? "default" : "ghost"}
                aria-pressed={preset === option.value}
                onClick={() => selectPreset(option.value)}
              >
                {option.value === "custom" ? (
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                ) : null}
                {option.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {showHostelFilter ? (
              <div className="grid gap-2">
                <Label htmlFor="owner-hostel-filter">Hostel</Label>
                <Select value={hostelFilter} onValueChange={setHostelFilter}>
                  <SelectTrigger id="owner-hostel-filter" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hostels</SelectItem>
                    {hostels.data?.map((hostel) => (
                      <SelectItem key={hostel.id} value={hostel.id}>
                        {hostel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="owner-from-date">From</Label>
              <Input
                id="owner-from-date"
                type="date"
                value={range.fromDate}
                onChange={(event) => {
                  const fromDate = event.target.value
                  setPreset("custom")
                  setRange((current) => ({
                    fromDate,
                    toDate:
                      current.toDate < fromDate ? fromDate : current.toDate,
                  }))
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="owner-to-date">To</Label>
              <Input
                id="owner-to-date"
                type="date"
                value={range.toDate}
                onChange={(event) => {
                  const toDate = event.target.value
                  setPreset("custom")
                  setRange((current) => ({
                    fromDate:
                      current.fromDate > toDate ? toDate : current.fromDate,
                    toDate,
                  }))
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {refreshing ? <RefreshSkeleton /> : null}

      <div
        className={cn(
          "grid gap-6 transition-opacity duration-200",
          refreshing && "opacity-55"
        )}
        aria-busy={refreshing}
      >
        {!data.hasData ? (
          <EmptyState
            title="No analytics available for selected period"
            message={`No resident, finance, occupancy, complaint, or notice activity was found for ${exactRangeLabel}.`}
          />
        ) : (
          <>
            <PeriodSummary data={data} viewingLabel={viewingLabel} />

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                className={refreshClass(highlightRefresh)}
                title="Revenue Collected"
                value={formatCurrency(data.summary.revenue)}
                description={`Based on ${exactRangeLabel}`}
                icon={IndianRupee}
                tone="success"
                trend={
                  <MetricComparison
                    current={data.summary.revenue}
                    previous={previous?.summary.revenue}
                    previousLabel={previousLabel}
                  />
                }
              />
              <StatCard
                className={refreshClass(highlightRefresh)}
                title="Outstanding"
                value={formatCurrency(data.summary.pendingDues)}
                description={`Based on ${exactRangeLabel}`}
                icon={AlertTriangle}
                tone={data.summary.pendingDues > 0 ? "warning" : "success"}
                trend={
                  <MetricComparison
                    current={data.summary.pendingDues}
                    previous={previous?.summary.pendingDues}
                    previousLabel={previousLabel}
                    favorable="lower"
                  />
                }
              />
              <StatCard
                className={refreshClass(highlightRefresh)}
                title="Collection Rate"
                value={`${data.summary.collectionRate}%`}
                description={`Based on ${exactRangeLabel}`}
                icon={Activity}
                tone={data.summary.collectionRate >= 85 ? "success" : "warning"}
                trend={
                  <MetricComparison
                    current={data.summary.collectionRate}
                    previous={previous?.summary.collectionRate}
                    previousLabel={previousLabel}
                  />
                }
              />
              <StatCard
                className={refreshClass(highlightRefresh)}
                title="Average Occupancy"
                value={`${data.summary.occupancyRate}%`}
                description={`Based on ${exactRangeLabel}`}
                icon={BedDouble}
                tone={data.summary.occupancyRate >= 80 ? "success" : "warning"}
                trend={
                  <MetricComparison
                    current={data.summary.occupancyRate}
                    previous={previous?.summary.occupancyRate}
                    previousLabel={previousLabel}
                  />
                }
              />
              <StatCard
                className={refreshClass(highlightRefresh)}
                title="Admissions"
                value={data.summary.admissions}
                description={`Based on ${exactRangeLabel}`}
                icon={UserPlus}
                tone="info"
                trend={
                  <MetricComparison
                    current={data.summary.admissions}
                    previous={previous?.summary.admissions}
                    previousLabel={previousLabel}
                  />
                }
              />
              <StatCard
                className={refreshClass(highlightRefresh)}
                title="Overdue Amount"
                value={formatCurrency(data.summary.overdueAmount)}
                description={`Based on ${exactRangeLabel}`}
                icon={MessageSquareWarning}
                tone={data.summary.overdueAmount > 0 ? "danger" : "success"}
                trend={
                  <MetricComparison
                    current={data.summary.overdueAmount}
                    previous={previous?.summary.overdueAmount}
                    previousLabel={previousLabel}
                    favorable="lower"
                  />
                }
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                title="Revenue Intelligence"
                value={formatCurrency(data.summary.monthlyRevenue)}
                description={`Daily ${formatCurrency(data.summary.dailyRevenue)} · Yearly ${formatCurrency(data.summary.yearlyRevenue)}`}
                icon={IndianRupee}
                tone="success"
              />
              <StatCard
                title="Collection Efficiency"
                value={`${data.summary.collectionEfficiency}%`}
                description={`Expected ${formatCurrency(data.summary.expectedCollection)} · Actual ${formatCurrency(data.summary.actualCollection)}`}
                icon={Activity}
                tone={data.summary.collectionEfficiency >= 85 ? "success" : "warning"}
              />
              <StatCard
                title="Occupancy"
                value={`${data.summary.occupancyPercent}%`}
                description={`${data.summary.occupiedBeds} occupied · ${data.summary.vacantBeds} vacant`}
                icon={BedDouble}
                tone={data.summary.occupancyPercent >= 80 ? "success" : "warning"}
              />
              <StatCard
                title="Advance Liability"
                value={formatCurrency(data.summary.advanceLiability)}
                description={`Refund liability ${formatCurrency(data.summary.refundLiability)}`}
                icon={ShieldCheck}
                tone={data.summary.refundLiability > 0 ? "warning" : "info"}
              />
              <StatCard
                title="Outstanding Dues"
                value={formatCurrency(data.summary.outstandingDues)}
                description={`Overdue ${formatCurrency(data.summary.overdueAmount)}`}
                icon={MessageSquareWarning}
                tone={data.summary.outstandingDues > 0 ? "warning" : "success"}
              />
              <StatCard
                title="Admissions Conversion"
                value={`${data.summary.conversionRate}%`}
                description={`${data.summary.leads} leads · ${data.summary.admissions} admissions`}
                icon={UserPlus}
                tone={data.summary.conversionRate >= 40 ? "success" : "info"}
              />
            </section>

            <OwnerDecisionSection
              data={data}
              previous={previous}
              exactRangeLabel={exactRangeLabel}
            />

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>
                    Collections, billing, and outstanding dues across the selected period.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
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

              <Card>
                <CardHeader>
                  <CardTitle>Resident Activity</CardTitle>
                  <CardDescription>
                    Admissions, active residents, and departures for this period.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <OwnerMiniMetric
                    label="Active at period end"
                    value={data.summary.activeResidents}
                    detail={`${data.summary.billingResidents} residents in billing`}
                  />
                  <OwnerMiniMetric
                    label="Admissions"
                    value={data.summary.admissions}
                    detail={`${data.summary.monthlyGrowth}% growth`}
                  />
                  <OwnerMiniMetric
                    label="Resident churn"
                    value={`${data.summary.residentChurn}%`}
                    detail={`${data.summary.averageStayDurationDays} average stay days`}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Collection Trend</CardTitle>
                  <CardDescription>
                    Collection efficiency across the selected period.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={data.trends}
                    lines={[
                      {
                        key: "collectionEfficiency",
                        label: "Efficiency",
                        color: "#0891b2",
                      },
                    ]}
                    formatValue={(value) => `${value}%`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Occupancy Trend</CardTitle>
                  <CardDescription>
                    Occupied bed rate across the selected period.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={data.trends}
                    lines={[
                      {
                        key: "occupancyRate",
                        label: "Occupancy",
                        color: "#16a34a",
                      },
                    ]}
                    formatValue={(value) => `${value}%`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Advance Liability Trend</CardTitle>
                  <CardDescription>
                    Advance balance carried as hostel liability.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={data.trends}
                    lines={[
                      {
                        key: "advanceLiability",
                        label: "Liability",
                        color: "#7c3aed",
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Complaints</CardTitle>
                  <CardDescription>
                    Resident support requests opened during this period.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent>
                  <OwnerMiniMetric
                    label="Requests opened"
                    value={data.summary.complaints}
                    detail={
                      data.summary.complaints === 0
                        ? "No resident complaints recorded"
                        : "Review open requests and resolution times"
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notice Engagement</CardTitle>
                  <CardDescription>
                    Share of notice notifications read by recipients.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent>
                  <DonutMetric
                    value={data.summary.noticeEngagement}
                    total={100}
                    label={`${data.summary.noticeEngagement}% read`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resident Verification</CardTitle>
                  <CardDescription>
                    Verification completion for residents admitted in this period.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent>
                  <DonutMetric
                    value={data.onboarding.completed}
                    total={data.onboarding.totalResidents}
                    label={`${data.onboarding.completionRate}% verified`}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Dues Aging</CardTitle>
                  <CardDescription>
                    Outstanding balances from fee records in this period.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
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
                  <CardTitle>Owner Actions</CardTitle>
                  <CardDescription>
                    Prioritized actions from the selected period&apos;s signals.
                  </CardDescription>
                  <PeriodBasis label={exactRangeLabel} />
                </CardHeader>
                <CardContent className="grid gap-3">
                  {data.insights.map((insight) => (
                    <article
                      key={`${insight.severity}-${insight.title}`}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            insight.severity === "critical"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {humanizeEnum(insight.severity)}
                        </Badge>
                        <h3 className="text-sm font-semibold">{insight.title}</h3>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {insight.description}
                      </p>
                      <p className="mt-2 text-sm font-medium">{insight.action}</p>
                    </article>
                  ))}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </ResponsiveContainer>
  )
}

function PeriodSummary({
  data,
  viewingLabel,
}: {
  data: OwnerAnalytics
  viewingLabel: string
}) {
  const metrics = [
    ["Revenue Collected", formatCurrency(data.summary.revenue)],
    ["Outstanding", formatCurrency(data.summary.pendingDues)],
    ["Occupancy", `${data.summary.occupancyRate}%`],
    ["Admissions", String(data.summary.admissions)],
    ["Complaints", String(data.summary.complaints)],
    ["Notice Engagement", `${data.summary.noticeEngagement}%`],
  ]

  return (
    <section
      className="border-y border-emerald-200 bg-emerald-50/60 py-4"
      aria-label={`Viewing ${viewingLabel}`}
    >
      <div className="px-1">
        <p className="text-sm font-semibold text-emerald-950">
          Viewing {viewingLabel}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-emerald-800">{label}</p>
              <p className="mt-1 text-lg font-semibold text-emerald-950">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OwnerDecisionSection({
  data,
  previous,
  exactRangeLabel,
}: {
  data: OwnerAnalytics
  previous?: OwnerAnalytics
  exactRangeLabel: string
}) {
  const decisions = buildHealthDecisions(data, previous)

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Owner Decision Center</h2>
          <p className="text-sm text-muted-foreground">
            What is healthy, what needs attention, and why.
          </p>
        </div>
        <PeriodBasis label={exactRangeLabel} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {decisions.map((decision) => (
          <Card key={decision.title} size="sm">
            <CardHeader>
              <CardTitle>{decision.title}</CardTitle>
              <HealthBadge status={decision.status} />
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {decision.reason}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function buildHealthDecisions(
  data: OwnerAnalytics,
  previous?: OwnerAnalytics
): Array<{ title: string; status: HealthStatus; reason: string }> {
  const revenueChange = percentChange(
    data.summary.revenue,
    previous?.summary.revenue
  )
  const revenueStatus: HealthStatus =
    data.summary.revenue <= 0
      ? "critical"
      : revenueChange < -10
        ? "attention"
        : "good"
  const occupancyStatus: HealthStatus =
    data.summary.occupancyRate >= 85
      ? "good"
      : data.summary.occupancyRate >= 65
        ? "attention"
        : "critical"
  const collectionStatus: HealthStatus =
    data.summary.collectionRate >= 90
      ? "good"
      : data.summary.collectionRate >= 75
        ? "attention"
        : "critical"
  const satisfactionStatus: HealthStatus =
    data.summary.complaints <= 2 && data.summary.noticeEngagement >= 70
      ? "good"
      : data.summary.complaints <= 5
        ? "attention"
        : "critical"
  const riskStatus: HealthStatus =
    data.summary.overdueAmount === 0
      ? "good"
      : data.summary.collectionRate >= 75
        ? "attention"
        : "critical"

  return [
    {
      title: "Revenue Health",
      status: revenueStatus,
      reason:
        revenueChange === 0
          ? `${formatCurrency(data.summary.revenue)} collected with no material period-over-period change.`
          : `${formatCurrency(data.summary.revenue)} collected, ${Math.abs(
              revenueChange
            )}% ${revenueChange >= 0 ? "above" : "below"} the previous period.`,
    },
    {
      title: "Occupancy Health",
      status: occupancyStatus,
      reason: `${data.summary.occupancyRate}% average bed occupancy across the selected period.`,
    },
    {
      title: "Collection Health",
      status: collectionStatus,
      reason: `${data.summary.collectionRate}% of billed fees collected; ${formatCurrency(
        data.summary.pendingDues
      )} remains outstanding.`,
    },
    {
      title: "Resident Satisfaction",
      status: satisfactionStatus,
      reason: `${data.summary.complaints} complaints and ${data.summary.noticeEngagement}% notice engagement.`,
    },
    {
      title: "Operational Risk",
      status: riskStatus,
      reason:
        data.summary.overdueAmount > 0
          ? `${formatCurrency(data.summary.overdueAmount)} is overdue and needs follow-up.`
          : "No overdue balance was detected for this period.",
    },
  ]
}

function HealthBadge({ status }: { status: HealthStatus }) {
  const label =
    status === "good"
      ? "Good"
      : status === "attention"
        ? "Needs Attention"
        : "Critical"

  return (
    <Badge
      variant={status === "critical" ? "destructive" : "secondary"}
      className={cn(
        status === "good" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "attention" &&
          "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      {status === "good" ? (
        <ShieldCheck className="size-3" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-3" aria-hidden="true" />
      )}
      {label}
    </Badge>
  )
}

function MetricComparison({
  current,
  previous,
  previousLabel,
  favorable = "higher",
}: {
  current: number
  previous?: number
  previousLabel: string
  favorable?: "higher" | "lower"
}) {
  if (previous === undefined) {
    return <span className="text-muted-foreground">Comparison loading...</span>
  }

  const change = percentChange(current, previous)
  const improved = favorable === "higher" ? change >= 0 : change <= 0
  const Icon = change >= 0 ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        improved ? "text-emerald-700" : "text-red-700"
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(change)}% vs {previousLabel}
    </span>
  )
}

function PeriodBasis({ label }: { label: string }) {
  return (
    <p className="text-xs font-medium text-muted-foreground">
      Based on: <span className="text-foreground">{label}</span>
    </p>
  )
}

function RefreshSkeleton() {
  return (
    <div
      className="grid gap-3"
      role="status"
      aria-live="polite"
      aria-label="Refreshing dashboard"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Refreshing dashboard...
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-lg border bg-muted/70"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}

function refreshClass(active: boolean) {
  return active
    ? "rounded-xl ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-background"
    : undefined
}

function percentChange(current: number, previous?: number) {
  if (previous === undefined || (previous === 0 && current === 0)) {
    return 0
  }

  if (previous === 0) {
    return 100
  }

  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1))
}

function TrendChart({
  data,
  lines,
  formatValue = formatCurrency,
}: {
  data: OwnerAnalytics["trends"]
  lines: Array<{
    key: keyof OwnerAnalytics["trends"][number]
    label: string
    color: string
  }>
  formatValue?: (value: number) => string
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
    return (
      <EmptyState
        title="No trend data for selected period"
        message="Monthly analytics will appear when operational records exist."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Owner trend chart"
        viewBox={`0 0 ${width} ${height}`}
        className="min-h-64 w-full min-w-[640px]"
      >
        <line
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
          stroke="#e5e7eb"
        />
        {lines.map((line) => {
          const points = data
            .map(
              (item, index) =>
                `${xFor(index)},${yFor(Number(item[line.key] ?? 0))}`
            )
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
              {data.map((item, index) => (
                <circle
                  key={`${String(line.key)}-${item.month}`}
                  cx={xFor(index)}
                  cy={yFor(Number(item[line.key] ?? 0))}
                  r="5"
                  fill={line.color}
                />
              ))}
            </g>
          )
        })}
        {data.map((item, index) => (
          <text
            key={item.month}
            x={xFor(index)}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {item.month}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3">
        {lines.map((line) => (
          <span
            key={String(line.key)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: line.color }}
            />
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
                <div
                  key={String(line.key)}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{line.label}</span>
                  <span className="font-medium text-foreground">
                    {formatValue(Number(item[line.key] ?? 0))}
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
  const percentage =
    total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100))

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

  if (data.length === 0) {
    return (
      <EmptyState
        title="No outstanding dues"
        message="No fee balances were found for the selected period."
      />
    )
  }

  return (
    <div className="grid gap-3">
      {data.map((item) => (
        <div key={item.label} className="grid gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground">
              {formatValue(item.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{
                width:
                  item.value === 0
                    ? "0%"
                    : `${Math.max(4, (item.value / maxValue) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}
