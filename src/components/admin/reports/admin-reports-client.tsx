"use client"

import { useState } from "react"
import { BarChart3, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { formatCurrency } from "@/lib/format"
import { useDashboardAnalytics } from "@/hooks"
import { reportsSdk } from "@/sdk/reports.sdk"
import type { ReportType } from "@/validations/report.validation"

const reportTypes: Array<{ type: ReportType; title: string; description: string }> = [
  { type: "payments", title: "Payments", description: "Payment and fee export." },
  { type: "residents", title: "Residents", description: "Resident profile export." },
  { type: "occupancy", title: "Occupancy", description: "Room occupancy export." },
  { type: "leaves", title: "Leaves", description: "Leave request export." },
]

export function AdminReportsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const analyticsQuery = useDashboardAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const [downloading, setDownloading] = useState<ReportType | null>(null)

  async function downloadReport(type: ReportType) {
    if (!organizationId) {
      return
    }

    setDownloading(type)

    try {
      const result = await reportsSdk.download(type, {
        organizationId,
        hostelId,
        format: "csv",
        maxRows: 10_000,
      })
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("Report export started.")
    } catch {
      toast.error("Report export failed.")
    } finally {
      setDownloading(null)
    }
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization not linked"
        message="Your admin account must be linked before reports can be exported."
      />
    )
  }

  const metrics = analyticsQuery.data

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
            label="Occupancy"
            value={`${metrics?.occupancy.occupancyRate ?? 0}%`}
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

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            Export tenant-scoped CSV reports for finance, residents, occupancy, and leaves.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {reportTypes.map((report) => (
            <article key={report.type} className="rounded-lg border p-4">
              <h2 className="font-semibold">{report.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
              <Button
                className="mt-4 gap-2"
                variant="outline"
                disabled={Boolean(downloading)}
                onClick={() => void downloadReport(report.type)}
              >
                {downloading === report.type ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Download CSV
              </Button>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
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
