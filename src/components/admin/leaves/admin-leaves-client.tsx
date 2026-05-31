"use client"

import { useState } from "react"
import { CalendarDays, CheckCircle2, Loader2, SearchX, XCircle } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
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
import { useLeaves, useReviewLeave } from "@/hooks"
import type { Tables } from "@/types/database"

const PAGE_SIZE = 12
const leaveStatuses = ["pending", "approved", "rejected", "departed", "returned", "cancelled"] as const

export function AdminLeavesClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<(typeof leaveStatuses)[number] | "all">("pending")
  const [rejectingLeave, setRejectingLeave] = useState<Tables<"leave_requests"> | null>(
    null
  )

  const leavesQuery = useLeaves({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
  })
  const approveLeave = useReviewLeave("approve")
  const leaves = leavesQuery.data?.data ?? []
  const meta = leavesQuery.data?.meta
  const pendingCount = leaves.filter((leave) => leave.status === "pending").length
  const approvedCount = leaves.filter((leave) => leave.status === "approved").length

  async function approve(leave: Tables<"leave_requests">) {
    if (!organizationId) {
      return
    }

    await approveLeave.mutateAsync({
      leaveRequestId: leave.id,
      organizationId,
    })
    toast.success("Leave request approved.")
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
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
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
                        <div className="font-medium">{leave.resident_id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">
                          {leave.travel_mode || "Travel mode not set"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(leave.from_date)} to {formatDate(leave.to_date)}
                      </TableCell>
                      <TableCell>
                        <div>{leave.destination || "Not provided"}</div>
                        <div className="max-w-72 truncate text-xs text-muted-foreground">
                          {leave.reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={leave.status} />
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
                            onClick={() => void approve(leave)}
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
      />
    </div>
  )
}

function RejectLeaveDialog({
  leave,
  organizationId,
  onClose,
}: {
  leave: Tables<"leave_requests"> | null
  organizationId: string
  onClose: () => void
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
