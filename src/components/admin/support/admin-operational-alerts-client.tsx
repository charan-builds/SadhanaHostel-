"use client"

import Link from "next/link"
import type { Route } from "next"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, Megaphone } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  useApproveResidentPasswordResetRequest,
  usePublishSupportRequestNotice,
  useSupportRequests,
  useUpdateSupportRequest,
} from "@/hooks"
import type { Tables } from "@/types/database"
import type { OperationalAlert } from "@/types/support"
import type { SupportPasswordResetApprovalResult } from "@/types/support"

export function AdminOperationalAlertsClient({
  passwordResetOnly = false,
}: {
  passwordResetOnly?: boolean
}) {
  const { organizationId, session } = useAuth()
  const searchParams = useSearchParams()
  const hostelId = session?.hostelIds[0]
  const passwordResetQueue =
    passwordResetOnly || searchParams.get("queue") === "password-resets"
  const residentReportQueue = searchParams.get("queue") === "resident-reports"
  const [passwordResetResult, setPasswordResetResult] =
    useState<SupportPasswordResetApprovalResult | null>(null)
  const alerts = useOperationalAlerts({
    organizationId: organizationId ?? undefined,
    hostelId,
  })
  const requests = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    category: passwordResetQueue ? "account" : undefined,
    workflow: passwordResetQueue
      ? "resident_password_reset"
      : residentReportQueue
        ? "resident_report"
        : undefined,
    page: 1,
    pageSize: 50,
  })
  const updateRequest = useUpdateSupportRequest()
  const approvePasswordReset = useApproveResidentPasswordResetRequest()
  const publishNotice = usePublishSupportRequestNotice()

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

  async function approveResidentPasswordReset(requestId: string) {
    if (!organizationId) {
      return
    }

    try {
      const result = await approvePasswordReset.mutateAsync({
        organizationId,
        requestId,
      })
      setPasswordResetResult(result)
      await requests.refetch()
      await alerts.refetch()
      toast.success("Temporary password generated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate temporary password.")
    }
  }

  async function publishResidentReport(request: Tables<"support_requests">) {
    if (!organizationId) {
      return
    }

    try {
      await publishNotice.mutateAsync({
        organizationId,
        requestId: request.id,
        audienceType: "hostel",
        isPinned: request.category === "safety" || request.priority === "urgent",
      })
      await requests.refetch()
      await alerts.refetch()
      toast.success("Resident report published as a notice.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to publish notice.")
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
        title={
          passwordResetQueue
            ? "Password Reset Requests"
            : residentReportQueue
              ? "Resident Reports"
              : "Operational Alerts"
        }
        description={
          passwordResetQueue
            ? "Verify resident identity, generate a temporary password, and share it securely."
            : residentReportQueue
              ? "Evaluate lost/found, maintenance, and safety reports before publishing notices."
            : "Recovery queue for blocked residents, payment reviews, onboarding issues, capacity risk, and missing configuration."
        }
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
        ) : visibleAlerts(alerts.data, passwordResetQueue, residentReportQueue).length ? (
          visibleAlerts(alerts.data, passwordResetQueue, residentReportQueue).map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        ) : (
          <div className="rounded-xl border bg-emerald-50 p-5 text-sm text-emerald-800 md:col-span-2 xl:col-span-4">
            <CheckCircle2 className="mb-2 size-5" aria-hidden="true" />
            {passwordResetQueue
              ? "No resident password reset requests are currently waiting."
              : residentReportQueue
                ? "No resident reports are currently waiting for review."
              : "No operational blockers are currently detected."}
          </div>
        )}
      </section>

      <DataTableShell
        title={
          passwordResetQueue
            ? "Resident password reset queue"
            : residentReportQueue
              ? "Resident report review queue"
              : "Support recovery queue"
        }
        description={
          passwordResetQueue
            ? "Only resident password reset requests are shown here."
            : residentReportQueue
              ? "Review resident-submitted lost/found and issue reports, then publish safe items as notices."
            : "Track and resolve resident support requests without opening Supabase."
        }
        empty={
          requests.data?.data.length === 0 ? (
            <EmptyState
              title={
                passwordResetQueue
                  ? "No password reset requests"
                  : residentReportQueue
                    ? "No resident reports"
                    : "No recovery requests"
              }
              message={
                passwordResetQueue
                  ? "When an existing resident asks admin to reset their password, the request will appear here."
                  : residentReportQueue
                    ? "Lost/found, maintenance, and safety reports will appear here after residents submit them."
                  : "When residents get blocked by onboarding, uploads, payments, or account access, their requests will appear here."
              }
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
                    {isResidentPasswordResetRequest(request) &&
                    !hasActiveResidentPortalAccount(request) ? (
                      <Badge variant="outline">Invite required</Badge>
                    ) : null}
                    {isResidentReportRequest(request) ? (
                      <Badge variant="outline">
                        {hasPublishedNotice(request) ? "Notice published" : "Resident report"}
                      </Badge>
                    ) : null}
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
                  {isResidentPasswordResetRequest(request) &&
                  hasActiveResidentPortalAccount(request) ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        approvePasswordReset.isPending ||
                        request.status === "resolved" ||
                        request.status === "closed"
                      }
                      onClick={() => void approveResidentPasswordReset(request.id)}
                    >
                      {approvePasswordReset.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <KeyRound className="size-3.5" aria-hidden="true" />
                      )}
                      Generate temporary password
                    </Button>
                  ) : null}
                  {isResidentPasswordResetRequest(request) &&
                  !hasActiveResidentPortalAccount(request) ? (
                    <>
                      {request.resident_id ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/residents/${request.resident_id}` as Route}>
                            Open resident profile
                          </Link>
                        </Button>
                      ) : null}
                      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                        This resident record exists, but the portal account is not active yet.
                        Create or resend the invite before sharing login access.
                      </p>
                    </>
                  ) : null}
                  {isResidentReportRequest(request) && !hasPublishedNotice(request) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={publishNotice.isPending || request.status === "closed"}
                      onClick={() => void publishResidentReport(request)}
                    >
                      {publishNotice.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Megaphone className="size-3.5" aria-hidden="true" />
                      )}
                      Publish as notice
                    </Button>
                  ) : null}
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

      <PasswordResetResultDialog
        result={passwordResetResult}
        onClose={() => setPasswordResetResult(null)}
      />
    </div>
  )
}

function PasswordResetResultDialog({
  result,
  onClose,
}: {
  result: SupportPasswordResetApprovalResult | null
  onClose: () => void
}) {
  async function copyPassword() {
    if (!result?.reset.temporaryPassword) {
      return
    }

    try {
      await navigator.clipboard.writeText(result.reset.temporaryPassword)
      toast.success("Temporary password copied.")
    } catch {
      toast.error("Copy failed. Select and copy the password manually.")
    }
  }

  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Temporary resident password</DialogTitle>
          <DialogDescription>
            Share this only after identity verification. The resident must set a permanent password
            after login.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="grid gap-4">
            <div className="rounded-lg border bg-blue-50 p-4 text-blue-950">
              <p className="text-sm font-semibold">Expires {formatDateTime(result.reset.expiresAt)}</p>
              <div className="mt-3 grid gap-2 rounded-md bg-white/70 p-3 text-sm">
                <p>
                  Login: <span className="break-all font-medium">{result.reset.loginLink}</span>
                </p>
                <p>
                  Password:{" "}
                  <span className="break-all font-mono font-semibold">
                    {result.reset.temporaryPassword}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copyPassword()}>
                <Copy className="size-3.5" aria-hidden="true" />
                Copy password
              </Button>
              <Button asChild variant="outline">
                <a href={result.reset.loginLink} target="_blank" rel="noreferrer">
                  Open login
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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

function isResidentPasswordResetRequest(request: { metadata: unknown }) {
  return recordFromUnknown(request.metadata).workflow === "resident_password_reset"
}

function isResidentReportRequest(request: { category: string; metadata: unknown }) {
  const metadata = recordFromUnknown(request.metadata)

  return (
    metadata.workflow === "resident_report" ||
    ["lost_found", "maintenance", "safety"].includes(request.category)
  )
}

function hasPublishedNotice(request: { metadata: unknown }) {
  const publishedNoticeId = recordFromUnknown(request.metadata).publishedNoticeId

  return typeof publishedNoticeId === "string" && publishedNoticeId.length > 0
}

function hasActiveResidentPortalAccount(request: { metadata: unknown }) {
  return recordFromUnknown(request.metadata).portalAccountActive !== false
}

function visibleAlerts(
  alerts: OperationalAlert[] | undefined,
  passwordResetQueue: boolean,
  residentReportQueue: boolean
) {
  const source = alerts ?? []

  if (passwordResetQueue) {
    return source.filter((alert) => alert.id === "support.password_reset")
  }

  if (residentReportQueue) {
    return source.filter((alert) => alert.id === "support.resident_reports")
  }

  return source
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
