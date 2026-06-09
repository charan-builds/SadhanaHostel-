"use client"

import { useState } from "react"
import { BarChart3, CalendarDays, CreditCard, Download, FileText, IndianRupee, Loader2, Users, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import {
  MonthwiseDateRangeControls,
  type MonthwiseDateBasis,
} from "@/components/admin/analytics/monthwise-date-range-controls"
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
import {
  getMonthwiseQuickFilterRange,
  type MonthwiseDateRange,
  type MonthwiseQuickFilter,
} from "@/lib/monthwise-analytics"
import { useOwnerAnalytics } from "@/hooks"
import type { OwnerAnalytics } from "@/sdk"
import { reportsSdk } from "@/sdk/reports.sdk"
import type { ReportType } from "@/validations/report.validation"

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
  const [downloading, setDownloading] = useState<ReportType | null>(null)
  const [quickFilter, setQuickFilter] =
    useState<MonthwiseQuickFilter>("this-month")
  const [range, setRange] = useState<MonthwiseDateRange>(() =>
    getMonthwiseQuickFilterRange("this-month")
  )
  const [dateBasis, setDateBasis] = useState<MonthwiseDateBasis>("revenue")
  const [reportOutcome, setReportOutcome] = useState<{
    tone: "success" | "danger" | "warning"
    title: string
    description: string
  } | null>(null)
  const fromDate = range.fromDate
  const toDate = range.toDate
  const analyticsQuery = useOwnerAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
    fromDate,
    toDate,
  })

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
          <ReportMetric label="Residents" value={metrics?.summary.totalResidents ?? 0} />
          <ReportMetric
            label="Active residents"
            value={metrics?.summary.activeResidents ?? 0}
          />
          <ReportMetric
            label="Selected revenue"
            value={formatCurrency(metrics?.summary.revenue ?? 0)}
          />
          <ReportMetric
            label="Pending dues"
            value={formatCurrency(metrics?.summary.pendingDues ?? 0)}
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

      <MonthwiseDateRangeControls
        title="Report Scope"
        description="Apply a month or range and one date basis before exporting reports."
        range={range}
        quickFilter={quickFilter}
        onRangeChange={setRange}
        onQuickFilterChange={setQuickFilter}
        dateBasis={dateBasis}
        onDateBasisChange={setDateBasis}
        invalid={invalidDateRange}
      />

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
  metrics: OwnerAnalytics | undefined
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
  metrics: OwnerAnalytics | undefined
) {
  const totalResidents = metrics?.summary.totalResidents ?? 0
  const activeResidents = metrics?.summary.activeResidents ?? 0
  const selectedRevenue = metrics?.summary.revenue ?? 0
  const pendingDues = metrics?.summary.pendingDues ?? 0
  const latestTrend = metrics?.trends.at(-1)
  const paymentSubmissions = metrics?.trends.reduce(
    (total, trend) => total + trend.paymentSubmissions,
    0
  ) ?? 0
  const noticeEngagement = metrics?.trends.reduce(
    (total, trend) => total + trend.noticeEngagement,
    0
  ) ?? 0
  const leaveRequests = metrics?.trends.reduce(
    (total, trend) => total + trend.leaveRequests,
    0
  ) ?? 0

  switch (type) {
    case "payments":
      return [
        { label: "Selected revenue", value: formatCurrency(selectedRevenue) },
        { label: "Payment submissions", value: paymentSubmissions },
      ]
    case "monthly_fees":
      return [
        { label: "Pending dues", value: formatCurrency(pendingDues) },
        { label: "Active residents", value: activeResidents },
      ]
    case "invoices":
      return [
        { label: "Invoice basis", value: "Verified payments" },
        { label: "Collections", value: latestTrend?.collectionCount ?? 0 },
      ]
    case "residents":
      return [
        { label: "Total residents", value: totalResidents },
        { label: "Resident activity", value: latestTrend?.residentActivity ?? 0 },
      ]
    case "leaves":
      return [
        { label: "Leave requests", value: leaveRequests },
        { label: "Notice engagement", value: noticeEngagement },
      ]
  }
}
