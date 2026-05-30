"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  Download,
  IndianRupee,
  Loader2,
  TrendingUp,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime, humanizeEnum } from "@/lib/format"
import { useRealtimeOwnerAnalytics } from "@/lib/realtime"
import { useHostels, useOwnerAnalytics } from "@/hooks"
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
  const hostelId = hostelFilter === "all" ? undefined : hostelFilter
  const ownerAnalytics = useOwnerAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
    fromDate,
    toDate,
  })

  useRealtimeOwnerAnalytics({ enabled: Boolean(organizationId) })

  const selectedHostelLabel = useMemo(() => {
    if (hostelFilter === "all") {
      return "All hostels"
    }

    return hostels.data?.find((hostel) => hostel.id === hostelFilter)?.name ?? "Selected hostel"
  }, [hostelFilter, hostels.data])

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
        title="Organization access required"
        message="Your admin account must be linked to an organization before owner analytics can load."
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

  if (!data) {
    return (
      <EmptyState
        title="Analytics are not ready"
        message="Add rooms, residents, payments, and reservations to start seeing owner insights."
      />
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Owner Dashboard"
        description="Business intelligence for occupancy, revenue, dues, reservations, onboarding, and capacity risk."
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
            <Select value={hostelFilter} onValueChange={setHostelFilter}>
              <SelectTrigger id="owner-hostel-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hostels</SelectItem>
                {hostels.data?.map((hostel) => (
                  <SelectItem key={hostel.id} value={hostel.id}>
                    {hostel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          title="Occupancy"
          value={`${data.summary.occupancyRate}%`}
          description={`${data.capacity.occupiedBeds}/${data.capacity.totalBeds} beds occupied`}
          icon={BedDouble}
          tone={data.summary.occupancyRate >= 85 ? "success" : "warning"}
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

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Revenue and Occupancy Trend</CardTitle>
            <CardDescription>
              Monthly owner view across collections, billed dues, and occupied beds.
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

        <Card>
          <CardHeader>
            <CardTitle>Forecast</CardTitle>
            <CardDescription>30-day projection from recent occupancy and finance patterns.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ForecastMetric
              label="Forecast occupancy"
              value={`${data.forecasts.occupancy.forecastOccupancyRate}%`}
              detail={`${data.forecasts.occupancy.forecastOccupiedBeds} occupied beds expected`}
            />
            <ForecastMetric
              label="Expected vacancies"
              value={data.forecasts.expectedVacancies}
              detail={`${data.forecasts.occupancy.expectedJoins} expected joins, ${data.forecasts.occupancy.expectedChurn} expected exits`}
            />
            <ForecastMetric
              label="Expected revenue"
              value={formatCurrency(data.forecasts.revenue.expectedCollectedRevenue)}
              detail={`${data.forecasts.revenue.expectedCollectionRate}% expected collection rate`}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Operational Insights</CardTitle>
            <CardDescription>
              Prioritized owner actions from dues, occupancy, onboarding, and room-utilization signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
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

        <Card>
          <CardHeader>
            <CardTitle>Bed Availability</CardTitle>
            <CardDescription>
              {data.capacity.lastCalculatedAt
                ? `Last calculated ${formatDateTime(data.capacity.lastCalculatedAt)}`
                : "Calculated from current rooms and allocations"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DonutMetric
              value={data.capacity.occupiedBeds}
              total={data.capacity.totalBeds}
              label={`${data.capacity.availableBeds} beds available`}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <CapacityItem label="Reserved" value={data.capacity.reservedBeds} />
              <CapacityItem label="Maintenance" value={data.capacity.maintenanceBlockedBeds} />
              <CapacityItem label="Available" value={data.capacity.availableBeds} />
              <CapacityItem label="Total beds" value={data.capacity.totalBeds} />
            </div>
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
            <CardTitle>Onboarding Completion</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Room Utilization</CardTitle>
          <CardDescription>
            Underperforming rooms are active rooms below 50% utilization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Revenue Potential</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.roomUtilization.slice(0, 12).map((room) => (
                <TableRow key={room.roomId}>
                  <TableCell className="font-medium">{room.roomNumber}</TableCell>
                  <TableCell>{humanizeEnum(room.roomType)}</TableCell>
                  <TableCell>
                    {room.occupied}/{room.capacity}
                  </TableCell>
                  <TableCell>
                    <ProgressBar value={room.utilizationRate} />
                  </TableCell>
                  <TableCell>{formatCurrency(room.revenuePotential)}</TableCell>
                  <TableCell>
                    <Badge variant={room.underperforming ? "destructive" : "secondary"}>
                      {room.underperforming ? "Under target" : humanizeEnum(room.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ResponsiveContainer>
  )
}

function ForecastMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function CapacityItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
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
            <polyline
              key={String(line.key)}
              fill="none"
              stroke={line.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
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

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex min-w-36 items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-emerald-600"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground">{value}%</span>
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
