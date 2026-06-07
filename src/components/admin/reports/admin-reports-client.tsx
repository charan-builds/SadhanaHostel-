"use client"

import { useState } from "react"
import { BarChart3, CalendarDays, CreditCard, Download, FileText, IndianRupee, Loader2, Users, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { WorkflowStatus } from "@/components/system/workflow-status"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/format"
import { useDashboardAnalytics } from "@/hooks"
import { reportsSdk } from "@/sdk/reports.sdk"
import type { ReportType } from "@/validations/report.validation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const reportTypes: Array<{
  type: ReportType
  title: string
  description: string
  question: string
  icon: LucideIcon
}> = [
  {
    type: "payments",
    title: "Payments",
    description: "Verified, pending, failed, and manually recorded payment rows.",
    question: "Which payments changed in this period?",
    icon: CreditCard,
  },
  {
    type: "monthly_fees",
    title: "Monthly Fees",
    description: "Due, paid, pending, overdue, and reconciled fee records.",
    question: "Who owes money and why?",
    icon: IndianRupee,
  },
  {
    type: "invoices",
    title: "Invoices",
    description: "Generated invoice and reconciliation rows.",
    question: "Which receipts/invoices are ready?",
    icon: FileText,
  },
  {
    type: "residents",
    title: "Residents",
    description: "Resident profile, lifecycle, and onboarding rows.",
    question: "Who joined, left, or needs follow-up?",
    icon: Users,
  },
  {
    type: "leaves",
    title: "Leaves",
    description: "Leave and gate-status review export.",
    question: "Who is away or returning soon?",
    icon: CalendarDays,
  },
]

export function AdminReportsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const analyticsQuery = useDashboardAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const [downloading, setDownloading] = useState<ReportType | null>(null)
  const [fromDate, setFromDate] = useState(() => monthStartInput())
  const [toDate, setToDate] = useState(() => todayInput())
  const [dateBasis, setDateBasis] = useState<"revenue" | "activity">("revenue")
  const [reportOutcome, setReportOutcome] = useState<{
    tone: "success" | "danger" | "warning"
    title: string
    description: string
  } | null>(null)

  async function downloadReport(type: ReportType) {
    if (!organizationId) {
      return
    }

    if (fromDate > toDate) {
      setReportOutcome({
        tone: "warning",
        title: "Report date range needs correction",
        description: "Choose a From date that is on or before the To date before exporting.",
      })
      return
    }

    setDownloading(type)
    setReportOutcome(null)

    try {
      const result = await reportsSdk.download(type, {
        organizationId,
        hostelId,
        fromDate,
        toDate,
        dateBasis,
        format: "csv",
        maxRows: 10_000,
      })
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      setReportOutcome({
        tone: "success",
        title: "Report export prepared",
        description: `${result.fileName} was generated for ${fromDate} to ${toDate} using ${dateBasis} date basis.`,
      })
      toast.success("Report export started.")
    } catch (error) {
      setReportOutcome({
        tone: "danger",
        title: "Report export failed",
        description:
          error instanceof FrontendApiError
            ? error.message
            : "Report export failed. Retry after checking the selected date range.",
      })
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Report export failed."
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

  const metrics = analyticsQuery.data
  const invalidDateRange = fromDate > toDate

  return (
    <div className="grid gap-6">
      {analyticsQuery.isError ? (
        <APIErrorState
          title="Report metrics could not be loaded"
          error={analyticsQuery.error}
          onRetry={() => void analyticsQuery.refetch()}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <ReportMetric label="Residents" value={metrics?.totalResidents ?? 0} />
          <ReportMetric
            label="Active residents"
            value={metrics?.residentLifecycle.activeResidents ?? 0}
          />
          <ReportMetric
            label="Monthly revenue"
            value={formatCurrency(metrics?.finance.monthlyRevenue ?? 0)}
          />
          <ReportMetric
            label="Pending dues"
            value={formatCurrency(metrics?.finance.pendingDues ?? 0)}
          />
        </div>
      )}

      {reportOutcome ? (
        <WorkflowStatus
          tone={reportOutcome.tone}
          title={reportOutcome.title}
          description={reportOutcome.description}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Report Scope</CardTitle>
          <CardDescription>
            Apply one date range and one date basis before exporting any report.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="report-from-date">From</Label>
            <Input
              id="report-from-date"
              type="date"
              value={fromDate}
              aria-invalid={invalidDateRange}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-to-date">To</Label>
            <Input
              id="report-to-date"
              type="date"
              value={toDate}
              aria-invalid={invalidDateRange}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Date basis</Label>
            <Select value={dateBasis} onValueChange={(value) => setDateBasis(value as typeof dateBasis)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue date</SelectItem>
                <SelectItem value="activity">Activity date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFromDate(todayInput())
                setToDate(todayInput())
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFromDate(monthStartInput())
                setToDate(todayInput())
              }}
            >
              This month
            </Button>
          </div>
          {invalidDateRange ? (
            <p className="text-sm text-destructive lg:col-span-4">
              From date must be on or before To date.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Previews</CardTitle>
          <CardDescription>
            Pick the report that answers the question before downloading CSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportTypes.map((report) => (
            <ReportExportCard
              key={report.type}
              report={report}
              metrics={metrics}
              downloading={downloading}
              disabled={invalidDateRange}
              onDownload={() => void downloadReport(report.type)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ReportExportCard({
  report,
  metrics,
  downloading,
  disabled,
  onDownload,
}: {
  report: (typeof reportTypes)[number]
  metrics: ReturnType<typeof useDashboardAnalytics>["data"]
  downloading: ReportType | null
  disabled: boolean
  onDownload: () => void
}) {
  const Icon = report.icon
  const preview = getReportPreview(report.type, metrics)

  return (
    <article className="rounded-lg border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{report.title}</h2>
          <p className="mt-1 text-sm font-medium text-primary">{report.question}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
              <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
      <div className="mt-4 grid gap-2">
        {preview.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
              <Button
                className="mt-4 gap-2"
                variant="outline"
                disabled={disabled || Boolean(downloading)}
        onClick={onDownload}
              >
                {downloading === report.type ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Download CSV
              </Button>
    </article>
  )
}

function ReportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <BarChart3 className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function getReportPreview(
  type: ReportType,
  metrics: ReturnType<typeof useDashboardAnalytics>["data"]
) {
  const totalResidents = metrics?.totalResidents ?? 0
  const activeResidents = metrics?.residentLifecycle.activeResidents ?? 0
  const monthlyRevenue = metrics?.finance.monthlyRevenue ?? 0
  const pendingDues = metrics?.finance.pendingDues ?? 0
  const pendingPayments = metrics?.finance.pendingPayments ?? 0
  const activeLeaves = metrics?.operations.activeLeaves ?? 0
  const pendingInvites = metrics?.operations.pendingInvites ?? 0

  switch (type) {
    case "payments":
      return [
        { label: "Monthly revenue", value: formatCurrency(monthlyRevenue) },
        { label: "Pending proofs", value: pendingPayments },
      ]
    case "monthly_fees":
      return [
        { label: "Pending dues", value: formatCurrency(pendingDues) },
        { label: "Active residents", value: activeResidents },
      ]
    case "invoices":
      return [
        { label: "Invoice basis", value: "Verified payments" },
        { label: "Queue risk", value: pendingPayments },
      ]
    case "residents":
      return [
        { label: "Total residents", value: totalResidents },
        { label: "Pending invites", value: pendingInvites },
      ]
    case "leaves":
      return [
        { label: "Active leaves", value: activeLeaves },
        { label: "Gate status", value: "Leave queue" },
      ]
  }
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartInput() {
  const date = new Date()
  date.setUTCDate(1)

  return date.toISOString().slice(0, 10)
}
