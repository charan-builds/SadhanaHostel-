"use client"

import {
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Settings,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime } from "@/lib/format"
import {
  usePaymentProofPreview,
  usePaymentSettings,
  usePayments,
  useRejectPayment,
  useVerifyPayment,
} from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import type { Tables } from "@/types/database"

export function AdminPaymentsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [selectedPayment, setSelectedPayment] = useState<Tables<"payments"> | null>(null)
  const [rejectedPayment, setRejectedPayment] = useState<Tables<"payments"> | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const payments = usePayments({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 50,
  })
  const verifyPayment = useVerifyPayment()
  const rejectPayment = useRejectPayment()
  const proofPreview = usePaymentProofPreview()
  const paymentSettings = usePaymentSettings(
    organizationId && hostelId ? { organizationId, hostelId } : undefined
  )

  if (!organizationId) {
    return <EmptyState title="Organization access required" message="Payments need an assigned organization." />
  }

  const pendingPayments = payments.data?.data.filter((payment) => payment.status === "pending") ?? []
  const verifiedPayments = payments.data?.data.filter((payment) => payment.status === "verified") ?? []

  async function confirmVerification() {
    if (!organizationId || !selectedPayment) {
      return
    }

    try {
      await verifyPayment.mutateAsync({
        organizationId,
        paymentId: selectedPayment.id,
        idempotencyKey: `verify-${selectedPayment.id}`,
      })

      await payments.refetch()
      toast.success("Payment verified. Linked invoices are generated server-side.")
      setSelectedPayment(null)
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to verify payment."
      )
    }
  }

  async function confirmRejection() {
    if (!organizationId || !rejectedPayment) {
      return
    }

    try {
      await rejectPayment.mutateAsync({
        organizationId,
        paymentId: rejectedPayment.id,
        reason: rejectionReason,
      })

      await payments.refetch()
      toast.success("Payment rejected and proof marked for review.")
      setRejectedPayment(null)
      setRejectionReason("")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to reject payment."
      )
    }
  }

  async function openPaymentProof(payment: Tables<"payments">) {
    if (!organizationId) {
      return
    }

    try {
      const result = await proofPreview.mutateAsync({
        organizationId,
        paymentId: payment.id,
        expiresInSeconds: 900,
      })

      window.open(result.signedUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to open payment proof."
      )
    }
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Payments"
        description="Review resident UPI submissions, verify payments, and let the backend generate linked invoices atomically."
        actions={
          <Button asChild variant="outline">
            <Link href={"/admin/finance/payment-security" as Route}>
              <Settings className="size-4" aria-hidden="true" />
              Payment Security
            </Link>
          </Button>
        }
      />

      {payments.error ? (
        <APIErrorState
          title="Payments failed to load"
          message="Unable to load payment records."
          onRetry={() => void payments.refetch()}
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Pending Verification" value={pendingPayments.length} />
        <SummaryCard label="Verified on page" value={verifiedPayments.length} />
        <SummaryCard
          label="Active UPI"
          value={paymentSettings.data?.upi_id ?? "Not configured"}
        />
        <SummaryCard
          label="Amount on page"
          value={formatCurrency(
            payments.data?.data.reduce((total, payment) => total + payment.amount, 0) ?? 0
          )}
        />
      </section>

      <DataTableShell
        title="Payment Queue"
        description="Pending and recent payment records. Verified payments are immutable in the backend."
        empty={
          payments.data?.data.length === 0 ? (
            <EmptyState
              title="No payment submissions yet"
              message="Resident UPI submissions appear here after they upload a proof and UTR. Configure the active QR before collecting payments."
              action={
                <Button asChild>
                  <Link href={"/admin/finance/payment-security" as Route}>
                    Open payment security
                  </Link>
                </Button>
              }
            />
          ) : undefined
        }
      >
        {payments.isLoading ? (
          <LoadingState variant="table" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data?.data.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.id.slice(0, 8)}</TableCell>
                  <TableCell>{payment.resident_id.slice(0, 8)}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{payment.transaction_id ?? payment.manual_reference ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(payment.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={proofPreview.isPending}
                        onClick={() => void openPaymentProof(payment)}
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        Proof
                      </Button>
                      <Button
                        size="sm"
                        disabled={payment.status !== "pending" || verifyPayment.isPending}
                        onClick={() => setSelectedPayment(payment)}
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={payment.status !== "pending" || rejectPayment.isPending}
                        onClick={() => {
                          setRejectedPayment(payment)
                          setRejectionReason("")
                        }}
                      >
                        <XCircle className="size-3.5" aria-hidden="true" />
                        Reject
                      </Button>
                      {payment.invoice_id ? (
                        <Button size="sm" variant="outline" disabled>
                          <FileText className="size-3.5" aria-hidden="true" />
                          Invoice ready
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableShell>

      <ConfirmDialog
        open={Boolean(selectedPayment)}
        onOpenChange={(open) => !open && setSelectedPayment(null)}
        title="Verify payment?"
        description="Only verify after checking the UPI reference and uploaded proof. This action is protected by financial audit rules."
        confirmLabel={verifyPayment.isPending ? "Verifying..." : "Verify payment"}
        onConfirm={() => void confirmVerification()}
      />

      <Dialog
        open={Boolean(rejectedPayment)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectedPayment(null)
            setRejectionReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment?</DialogTitle>
            <DialogDescription>
              Add a clear reason so the resident can resubmit with a corrected UPI reference or proof.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rejectionReason">Reason</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Example: UTR does not match the screenshot."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectedPayment(null)
                setRejectionReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectionReason.trim().length < 6 || rejectPayment.isPending}
              onClick={() => void confirmRejection()}
            >
              {rejectPayment.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <XCircle className="size-4" aria-hidden="true" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {verifyPayment.isPending ? (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-lg">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Updating financial records...
        </div>
      ) : null}
    </ResponsiveContainer>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
