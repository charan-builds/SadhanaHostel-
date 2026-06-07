"use client"

import { useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Loader2, SearchX, XCircle } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { formatDate, formatDateTime, humanizeEnum } from "@/lib/format"
import { useLeaves, useResidents, useReviewLeave } from "@/hooks"
import type { Tables } from "@/types/database"

const PAGE_SIZE = 12
const leaveStatuses = ["pending", "approved", "rejected", "departed", "returned", "cancelled"] as const
type LeaveOutcome = {
  tone: "success" | "warning" | "info"
  title: string
  description: string
}

export function AdminLeavesClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<(typeof leaveStatuses)[number] | "all">("pending")
  const [rejectingLeave, setRejectingLeave] = useState<Tables<"leave_requests"> | null>(
    null
  )
  const [approvingLeave, setApprovingLeave] = useState<Tables<"leave_requests"> | null>(null)
  const [leaveOutcome, setLeaveOutcome] = useState<LeaveOutcome | null>(null)

  const leavesQuery = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
  })
  const residentsQuery = useResidents({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 100,
  })
  const approveLeave = useReviewLeave("approve")
  const leaves = leavesQuery.data?.data ?? []
  const meta = leavesQuery.data?.meta
  const pendingCount = leaves.filter((leave) => leave.status === "pending").length
  const approvedCount = leaves.filter((leave) => leave.status === "approved").length
  const residentById = useMemo(() => {
    return new Map(
      (residentsQuery.data?.data ?? []).map((resident) => [resident.id, resident])
    )
  }, [residentsQuery.data?.data])

  async function confirmApprove() {
    if (!organizationId || !approvingLeave) {
      return
    }

    const leave = approvingLeave
    await approveLeave.mutateAsync({
      leaveRequestId: leave.id,
      organizationId,
    })
    await leavesQuery.refetch()
    const resident = residentById.get(leave.resident_id)
    setLeaveOutcome({
      tone: "success",
      title: "Leave approved",
      description: `${resident?.full_name ?? `Resident ${leave.resident_id.slice(0, 8)}`} is approved from ${formatDate(leave.from_date)} to ${formatDate(leave.to_date)}. The resident sees this status in leave history.`,
    })
    toast.success("Leave request approved.")
    setApprovingLeave(null)
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
      <div className="grid gap-4 md:grid-cols-3">
        <LeaveMetric label="Requests on page" value={leaves.length} />
        <LeaveMetric label="Pending" value={pendingCount} />
        <LeaveMetric label="Approved" value={approvedCount} />
      </div>

      {leaveOutcome ? (
        <WorkflowStatus
          tone={leaveOutcome.tone}
          title={leaveOutcome.title}
          description={leaveOutcome.description}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>
            Review resident leave applications and keep status changes audit-friendly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as typeof status)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full md:w-52" aria-label="Filter leave status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {leaveStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {humanizeEnum(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {leavesQuery.isLoading ? (
            <LeaveSkeleton />
          ) : leavesQuery.isError ? (
            <APIErrorState
              title="Leave requests could not be loaded"
              error={leavesQuery.error}
              onRetry={() => void leavesQuery.refetch()}
            />
          ) : leaves.length === 0 ? (
            <EmptyState
              title="No leave requests found"
              message="Requests matching the selected status will appear here."
              action={
                status !== "pending" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStatus("pending")
                      setPage(1)
                    }}
                  >
                    Show pending
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 lg:hidden">
                {leaves.map((leave) => (
                  <LeaveRequestCard
                    key={leave.id}
                    leave={leave}
                    resident={residentById.get(leave.resident_id)}
                    approving={approveLeave.isPending}
                    onApprove={() => setApprovingLeave(leave)}
                    onReject={() => setRejectingLeave(leave)}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resident</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell>
                          <LeaveResidentSummary
                            leave={leave}
                            resident={residentById.get(leave.resident_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            {formatDate(leave.from_date)} to {formatDate(leave.to_date)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getLeaveDurationDays(leave.from_date, leave.to_date)} day leave
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{leave.destination || "Not provided"}</div>
                          <div className="max-w-72 truncate text-xs text-muted-foreground">
                            {leave.reason}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-2">
                            <StatusBadge status={leave.status} />
                            <span className="text-xs text-muted-foreground">
                              {getLeaveConsequence(leave)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDateTime(leave.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              disabled={
                                leave.status !== "pending" || approveLeave.isPending
                              }
                              onClick={() => setApprovingLeave(leave)}
                            >
                              {approveLeave.isPending ? (
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CheckCircle2 className="size-4" aria-hidden="true" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2 text-destructive hover:text-destructive"
                              disabled={leave.status !== "pending"}
                              onClick={() => setRejectingLeave(leave)}
                            >
                              <XCircle className="size-4" aria-hidden="true" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {leaves.length} of {meta?.total ?? 0} leave requests
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!meta || page <= 1 || leavesQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!meta || page >= meta.totalPages || leavesQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <RejectLeaveDialog
        leave={rejectingLeave}
        organizationId={organizationId}
        onClose={() => setRejectingLeave(null)}
        onRejected={(leave) => {
          const resident = residentById.get(leave.resident_id)
          setLeaveOutcome({
            tone: "warning",
            title: "Leave rejected",
            description: `${resident?.full_name ?? `Resident ${leave.resident_id.slice(0, 8)}`} will see the rejection reason in leave history and can submit a corrected request.`,
          })
          void leavesQuery.refetch()
        }}
      />

      <ConfirmDialog
        open={Boolean(approvingLeave)}
        onOpenChange={(open) => !open && setApprovingLeave(null)}
        title="Approve leave request?"
        description={
          approvingLeave
            ? `Approving marks ${residentById.get(approvingLeave.resident_id)?.full_name ?? `resident ${approvingLeave.resident_id.slice(0, 8)}`} as approved from ${formatDate(approvingLeave.from_date)} to ${formatDate(approvingLeave.to_date)}. The resident will see the approval in leave history.`
            : undefined
        }
        confirmLabel={approveLeave.isPending ? "Approving..." : "Approve leave"}
        onConfirm={confirmApprove}
      />
    </div>
  )
}

function RejectLeaveDialog({
  leave,
  organizationId,
  onClose,
  onRejected,
}: {
  leave: Tables<"leave_requests"> | null
  organizationId: string
  onClose: () => void
  onRejected: (leave: Tables<"leave_requests">) => void
}) {
  const [reason, setReason] = useState("")
  const rejectLeave = useReviewLeave("reject")

  async function reject() {
    if (!leave) {
      return
    }

    await rejectLeave.mutateAsync({
      leaveRequestId: leave.id,
      organizationId,
      rejectionReason: reason,
    })
    toast.success("Leave request rejected.")
    onRejected(leave)
    setReason("")
    onClose()
  }

  return (
    <Dialog open={Boolean(leave)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Leave Request</DialogTitle>
          <DialogDescription>
            Add a clear reason. This is visible in resident leave history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="rejectionReason">Rejection reason</Label>
          <Textarea
            id="rejectionReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={rejectLeave.isPending || reason.trim().length < 3}
            onClick={() => void reject()}
          >
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaveRequestCard({
  leave,
  resident,
  approving,
  onApprove,
  onReject,
}: {
  leave: Tables<"leave_requests">
  resident?: Tables<"residents">
  approving: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const pending = leave.status === "pending"

  return (
    <article className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <LeaveResidentSummary leave={leave} resident={resident} />
        <StatusBadge status={leave.status} />
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <LeaveInfo label="Leave dates" value={`${formatDate(leave.from_date)} to ${formatDate(leave.to_date)}`} />
        <LeaveInfo label="Duration" value={`${getLeaveDurationDays(leave.from_date, leave.to_date)} day leave`} />
        <LeaveInfo label="Destination" value={leave.destination || "Not provided"} />
        <LeaveInfo label="Reason" value={leave.reason} />
        <LeaveInfo label="Requested" value={formatDateTime(leave.created_at)} />
      </div>

      <LeaveStatusTimeline leave={leave} />

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          className="min-h-11 flex-1"
          disabled={!pending || approving}
          onClick={onApprove}
        >
          {approving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          )}
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1"
          disabled={!pending}
          onClick={onReject}
        >
          <XCircle className="size-4" aria-hidden="true" />
          Reject
        </Button>
      </div>
    </article>
  )
}

function LeaveResidentSummary({
  leave,
  resident,
}: {
  leave: Tables<"leave_requests">
  resident?: Tables<"residents">
}) {
  return (
    <div className="min-w-0">
      <div className="font-medium">
        {resident?.full_name ?? `Resident ${leave.resident_id.slice(0, 8)}`}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {resident
          ? `${resident.admission_number} · ${resident.phone ?? "No phone"}`
          : `${leave.resident_id.slice(0, 8)} · ${leave.travel_mode || "Travel mode not set"}`}
      </div>
    </div>
  )
}

function LeaveInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[62%] text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function LeaveStatusTimeline({ leave }: { leave: Tables<"leave_requests"> }) {
  return (
    <div className="mt-4 rounded-xl border bg-background/70 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Status effect</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {getLeaveConsequence(leave)}
      </p>
      {leave.rejection_reason ? (
        <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          Reason: {leave.rejection_reason}
        </p>
      ) : null}
    </div>
  )
}

function getLeaveDurationDays(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T00:00:00Z`).getTime()
  const end = new Date(`${toDate}T00:00:00Z`).getTime()
  const diff = Math.max(0, end - start)

  return Math.floor(diff / 86_400_000) + 1
}

function getLeaveConsequence(leave: Tables<"leave_requests">) {
  if (leave.status === "approved") {
    return "Approved leave is visible to the resident. Use departed/returned tracking when gate status is enabled."
  }

  if (leave.status === "rejected") {
    return "Rejected leave stays in history with the reason so the resident can submit a corrected request."
  }

  if (leave.status === "departed") {
    return "Resident has departed. Confirm return when the resident comes back."
  }

  if (leave.status === "returned") {
    return "Resident has returned and this leave cycle is complete."
  }

  if (leave.status === "cancelled") {
    return "Cancelled requests are retained for audit history."
  }

  return "Pending request. Approve only after checking dates, destination, and resident contact."
}

function LeaveMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <CalendarDays className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function LeaveSkeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex h-16 items-center rounded-lg border bg-muted/50 px-4">
          <SearchX className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}
