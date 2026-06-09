"use client"

import Link from "next/link"
import type { Route } from "next"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  KeyRound,
  Loader2,
  Megaphone,
  MessageCircle,
} from "lucide-react"
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
  buildComplaintSlaInsight,
  getComplaintPriorityLabel,
  type ComplaintSlaInsight,
} from "@/lib/support/complaint-insights"
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
  const visitorQueue = searchParams.get("queue") === "visitors"
  const gatePassQueue = searchParams.get("queue") === "gate-pass"
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
        : visitorQueue
          ? "visitor_request"
          : gatePassQueue
            ? "gate_pass_request"
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

  async function approveVisitorRequest(requestId: string) {
    if (!organizationId) {
      return
    }

    try {
      await updateRequest.mutateAsync({
        organizationId,
        requestId,
        status: "resolved",
        resolutionNotes:
          "Visitor approved. Staff should verify the visitor at entry and record arrival/departure notes in the office log.",
      })
      await requests.refetch()
      await alerts.refetch()
      toast.success("Visitor request approved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve visitor request.")
    }
  }

  async function approveGatePassRequest(requestId: string) {
    if (!organizationId) {
      return
    }

    try {
      await updateRequest.mutateAsync({
        organizationId,
        requestId,
        status: "resolved",
        resolutionNotes:
          "Gate pass approved. Staff should record check-out time at exit and close this request after the resident returns.",
      })
      await requests.refetch()
      await alerts.refetch()
      toast.success("Gate pass approved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve gate pass.")
    }
  }

  async function closeGatePassRequest(requestId: string) {
    if (!organizationId) {
      return
    }

    try {
      await updateRequest.mutateAsync({
        organizationId,
        requestId,
        status: "closed",
        resolutionNotes:
          "Resident returned. Gate pass closed after staff check-in verification.",
      })
      await requests.refetch()
      await alerts.refetch()
      toast.success("Gate pass return logged.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log gate pass return.")
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
              : visitorQueue
                ? "Visitor Approvals"
                : gatePassQueue
                  ? "Gate Pass Approvals"
              : "Operational Alerts"
        }
        description={
          passwordResetQueue
            ? "Verify resident identity, generate a temporary password, and share it securely."
            : residentReportQueue
              ? "Evaluate lost/found, maintenance, and safety reports before publishing notices."
              : visitorQueue
                ? "Review resident visitor registrations, approve safe visits, and keep an office entry log."
                : gatePassQueue
                  ? "Review temporary check-out requests, approve passes, and log resident return."
              : "Recovery queue for blocked residents, payment reviews, profile issues, capacity risk, and missing configuration."
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
        ) : visibleAlerts(alerts.data, passwordResetQueue, residentReportQueue, visitorQueue, gatePassQueue).length ? (
          visibleAlerts(alerts.data, passwordResetQueue, residentReportQueue, visitorQueue, gatePassQueue).map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        ) : (
          <div className="rounded-xl border bg-emerald-50 p-5 text-sm text-emerald-800 md:col-span-2 xl:col-span-4">
            <CheckCircle2 className="mb-2 size-5" aria-hidden="true" />
            {passwordResetQueue
              ? "No resident password reset requests are currently waiting."
              : residentReportQueue
                ? "No resident reports are currently waiting for review."
                : visitorQueue
                  ? "No visitor approvals are currently waiting."
                  : gatePassQueue
                    ? "No gate pass approvals are currently waiting."
              : "No operational blockers are currently detected."}
          </div>
        )}
      </section>

      {gatePassQueue ? <GatePassWorkflowGuide /> : null}

      <DataTableShell
        title={
          passwordResetQueue
            ? "Resident password reset queue"
            : residentReportQueue
              ? "Resident report review queue"
              : visitorQueue
                ? "Visitor approval queue"
                : gatePassQueue
                  ? "Gate pass approval queue"
              : "Support recovery queue"
        }
        description={
          passwordResetQueue
            ? "Only resident password reset requests are shown here."
            : residentReportQueue
              ? "Review resident-submitted lost/found and issue reports, then publish safe items as notices."
              : visitorQueue
                ? "Approve visitor registrations and use resolution notes as the entry log handoff."
                : gatePassQueue
                  ? "Approve temporary check-out requests and close them after resident return."
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
                    : visitorQueue
                      ? "No visitor requests"
                      : gatePassQueue
                        ? "No gate pass requests"
                    : "No recovery requests"
              }
              message={
                passwordResetQueue
                  ? "When an existing resident asks admin to reset their password, the request will appear here."
                  : residentReportQueue
                    ? "Lost/found, maintenance, and safety reports will appear here after residents submit them."
                    : visitorQueue
                      ? "Visitor registrations will appear here after residents submit visitor pass requests."
                      : gatePassQueue
                        ? "Gate pass requests will appear here after residents submit temporary check-out requests."
                  : "When residents get blocked by profile, uploads, payments, or account access, their requests will appear here."
              }
            />
          ) : undefined
        }
      >
        {requests.isLoading ? (
          <div className="p-5 text-sm text-muted-foreground">Loading support queue...</div>
        ) : (
          <div className="divide-y">
            {requests.data?.data.map((request) => {
              const slaInsight = buildComplaintSlaInsight(request)

              return (
                <article key={request.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_18rem]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{request.subject}</h2>
                      <StatusBadge status={request.status} />
                      <Badge variant={request.priority === "urgent" ? "destructive" : "secondary"}>
                        {humanizeEnum(request.priority)}
                      </Badge>
                      <ComplaintSlaBadge insight={slaInsight} />
                      {slaInsight.requiresEscalation ? (
                        <Badge variant="destructive">Escalate</Badge>
                      ) : null}
                      {isResidentPasswordResetRequest(request) &&
                      !hasActiveResidentPortalAccount(request) ? (
                        <Badge variant="outline">Invite required</Badge>
                      ) : null}
                      {isResidentReportRequest(request) ? (
                        <Badge variant="outline">
                          {hasPublishedNotice(request) ? "Notice published" : "Resident report"}
                        </Badge>
                      ) : null}
                      {isVisitorRequest(request) ? (
                        <Badge variant="outline">Visitor request</Badge>
                      ) : null}
                      {isGatePassRequest(request) ? (
                        <Badge variant="outline">Gate pass</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {humanizeEnum(request.category)} · {getComplaintPriorityLabel(request.priority)} · {formatDateTime(request.created_at)}
                    </p>
                    <p className="mt-3 text-sm leading-6">{request.description}</p>
                    <ComplaintSlaPanel insight={slaInsight} />
                    {request.resolution_notes ? (
                      <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                        {request.resolution_notes}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid content-start gap-3">
                  {request.status === "open" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={slaInsight.requiresEscalation ? "default" : "outline"}
                      disabled={updateRequest.isPending}
                      onClick={() => void setStatus(request.id, "in_progress")}
                    >
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      Start review
                    </Button>
                  ) : null}
                  {isVisitorRequest(request) && request.status !== "resolved" && request.status !== "closed" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={updateRequest.isPending}
                      onClick={() => void approveVisitorRequest(request.id)}
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Approve visitor
                    </Button>
                  ) : null}
                  {isGatePassRequest(request) && request.status !== "resolved" && request.status !== "closed" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={updateRequest.isPending}
                      onClick={() => void approveGatePassRequest(request.id)}
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Approve gate pass
                    </Button>
                  ) : null}
                  {isGatePassRequest(request) && request.status === "resolved" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updateRequest.isPending}
                      onClick={() => void closeGatePassRequest(request.id)}
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Mark returned
                    </Button>
                  ) : null}
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
              )
            })}
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

function ComplaintSlaBadge({ insight }: { insight: ComplaintSlaInsight }) {
  return (
    <Badge variant={insight.tone === "critical" ? "destructive" : "outline"}>
      {insight.label}
    </Badge>
  )
}

function ComplaintSlaPanel({ insight }: { insight: ComplaintSlaInsight }) {
  return (
    <div className={complaintSlaPanelClass(insight.tone)}>
      <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal">
          {insight.requiresEscalation ? "Escalation required" : "SLA tracking"}
        </p>
        <p className="mt-1 text-sm leading-6">{insight.description}</p>
        {insight.dueAt ? (
          <p className="mt-1 text-xs opacity-80">Target response: {formatDateTime(insight.dueAt)}</p>
        ) : null}
      </div>
    </div>
  )
}

function complaintSlaPanelClass(tone: ComplaintSlaInsight["tone"]) {
  const base = "mt-3 flex gap-3 rounded-lg border p-3"

  return `${base} ${
    {
      success: "border-emerald-200 bg-emerald-50 text-emerald-900",
      warning: "border-amber-200 bg-amber-50 text-amber-950",
      critical: "border-destructive/25 bg-destructive/10 text-destructive",
      muted: "border-border bg-muted/40 text-muted-foreground",
    }[tone]
  }`
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

  async function copyWhatsappMessage() {
    if (!result?.whatsappMessage) {
      return
    }

    try {
      await navigator.clipboard.writeText(result.whatsappMessage)
      toast.success("WhatsApp message copied.")
    } catch {
      toast.error("Copy failed. Select and copy the message manually.")
    }
  }

  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
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
            <div className="rounded-lg border bg-emerald-50 p-4 text-emerald-950">
              <p className="text-sm font-semibold">WhatsApp-ready message</p>
              <p className="mt-1 text-xs leading-5 text-emerald-900">
                This includes the login link, temporary password, expiry, and reset instruction.
              </p>
              <Textarea
                readOnly
                value={result.whatsappMessage}
                className="mt-3 min-h-48 resize-none bg-white/80 font-mono text-xs leading-5"
                aria-label="WhatsApp password reset message"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copyPassword()}>
                <Copy className="size-3.5" aria-hidden="true" />
                Copy password
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyWhatsappMessage()}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                Copy WhatsApp message
              </Button>
              <Button asChild variant="outline">
                <a href={result.whatsappShareUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  Open WhatsApp
                </a>
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

function GatePassWorkflowGuide() {
  const steps = [
    {
      title: "Review request",
      description: "Check purpose, expected check-out time, return time, and resident contact.",
    },
    {
      title: "Approve pass",
      description: "Use Approve gate pass after the hostel office accepts the temporary check-out.",
    },
    {
      title: "Record check-out time",
      description: "Staff should note actual exit time in the office log before the resident leaves.",
    },
    {
      title: "Mark returned after check-in",
      description: "Close the request only after staff verify the resident has returned.",
    },
  ]

  return (
    <section className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Gate pass workflow</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Use this queue as the daily temporary check-out and return handoff.
          </p>
        </div>
        <Badge variant="secondary">Request to return</Badge>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-lg border bg-background/70 p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="text-sm font-semibold">{step.title}</h3>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
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

function isVisitorRequest(request: { category: string; metadata: unknown }) {
  return (
    request.category === "visitor" ||
    recordFromUnknown(request.metadata).workflow === "visitor_request"
  )
}

function isGatePassRequest(request: { category: string; metadata: unknown }) {
  return (
    request.category === "gate_pass" ||
    recordFromUnknown(request.metadata).workflow === "gate_pass_request"
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
  residentReportQueue: boolean,
  visitorQueue: boolean,
  gatePassQueue: boolean
) {
  const source = alerts ?? []

  if (passwordResetQueue) {
    return source.filter((alert) => alert.id === "support.password_reset")
  }

  if (residentReportQueue) {
    return source.filter((alert) => alert.id === "support.resident_reports")
  }

  if (visitorQueue) {
    return source.filter((alert) => alert.id === "support.visitor_requests")
  }

  if (gatePassQueue) {
    return source.filter((alert) => alert.id === "support.gate_pass_requests")
  }

  return source
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
