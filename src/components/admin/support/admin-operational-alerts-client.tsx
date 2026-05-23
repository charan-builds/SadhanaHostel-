"use client"

import Link from "next/link"
import type { Route } from "next"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import {
  useOperationalAlerts,
  useSupportRequests,
  useUpdateSupportRequest,
} from "@/hooks"
import type { OperationalAlert } from "@/types/support"

export function AdminOperationalAlertsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const alerts = useOperationalAlerts({
    organizationId: organizationId ?? undefined,
    hostelId,
  })
  const requests = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 50,
  })
  const updateRequest = useUpdateSupportRequest()

  async function setStatus(requestId: string, status: "in_progress" | "waiting_on_resident" | "resolved" | "closed") {
    if (!organizationId) {
      return
    }

    try {
      await updateRequest.mutateAsync({
        organizationId,
        requestId,
        status,
        resolutionNotes:
          status === "waiting_on_resident"
            ? "Please check the resident portal for the next recovery step."
            : undefined,
      })
      await requests.refetch()
      await alerts.refetch()
      toast.success("Support request updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update support request.")
    }
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Setup required"
        message="Finish organization and hostel setup before operational alerts can be calculated."
        action={
          <Button asChild>
            <Link href={"/admin/setup" as Route}>Open setup</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Operational Alerts"
        description="Recovery queue for blocked residents, payment reviews, onboarding issues, capacity risk, and missing configuration."
      />

      {alerts.isError ? (
        <APIErrorState
          title="Operational alerts could not be loaded"
          error={alerts.error}
          onRetry={() => void alerts.refetch()}
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {alerts.isLoading ? (
          <div className="rounded-xl border bg-background p-5 text-sm text-muted-foreground">
            Loading alerts...
          </div>
        ) : alerts.data?.length ? (
          alerts.data.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        ) : (
          <div className="rounded-xl border bg-emerald-50 p-5 text-sm text-emerald-800 md:col-span-2 xl:col-span-4">
            <CheckCircle2 className="mb-2 size-5" aria-hidden="true" />
            No operational blockers are currently detected.
          </div>
        )}
      </section>

      <DataTableShell
        title="Support recovery queue"
        description="Track and resolve resident support requests without opening Supabase."
        empty={
          requests.data?.data.length === 0 ? (
            <EmptyState
              title="No recovery requests"
              message="When residents get blocked by onboarding, uploads, payments, or account access, their requests will appear here."
            />
          ) : undefined
        }
      >
        {requests.isLoading ? (
          <div className="p-5 text-sm text-muted-foreground">Loading support queue...</div>
        ) : (
          <div className="divide-y">
            {requests.data?.data.map((request) => (
              <article key={request.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_18rem]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{request.subject}</h2>
                    <StatusBadge status={request.status} />
                    <Badge variant={request.priority === "urgent" ? "destructive" : "secondary"}>
                      {humanizeEnum(request.priority)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {humanizeEnum(request.category)} · {formatDateTime(request.created_at)}
                  </p>
                  <p className="mt-3 text-sm leading-6">{request.description}</p>
                  {request.resolution_notes ? (
                    <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                      {request.resolution_notes}
                    </div>
                  ) : null}
                </div>
                <div className="grid content-start gap-3">
                  <Select
                    value={request.status}
                    onValueChange={(value) =>
                      void setStatus(
                        request.id,
                        value as "in_progress" | "waiting_on_resident" | "resolved" | "closed"
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["open", "in_progress", "waiting_on_resident", "resolved", "closed"] as const).map((status) => (
                        <SelectItem key={status} value={status}>
                          {humanizeEnum(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    readOnly
                    value={request.resolution_notes ?? "Add guidance by moving this request to waiting on resident, resolved, or closed."}
                    className="min-h-24 resize-none text-xs"
                    aria-label="Resolution guidance"
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </DataTableShell>
    </div>
  )
}

function AlertCard({ alert }: { alert: OperationalAlert }) {
  const severityClass = {
    critical: "border-destructive/40 bg-destructive/5 text-destructive",
    high: "border-amber-300 bg-amber-50 text-amber-900",
    medium: "border-blue-200 bg-blue-50 text-blue-900",
    low: "border-slate-200 bg-slate-50 text-slate-900",
  }[alert.severity]

  return (
    <article className={`rounded-xl border p-4 ${severityClass}`}>
      <div className="flex items-start justify-between gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <Badge variant="secondary">{alert.count}</Badge>
      </div>
      <h2 className="mt-3 text-sm font-semibold">{alert.title}</h2>
      <p className="mt-2 text-sm leading-6 opacity-85">{alert.description}</p>
      <Button asChild variant="outline" size="sm" className="mt-4 bg-background">
        <Link href={alert.href as Route}>{alert.ctaLabel}</Link>
      </Button>
    </article>
  )
}
