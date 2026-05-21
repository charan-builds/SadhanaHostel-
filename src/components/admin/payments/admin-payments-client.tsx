"use client"

import { CheckCircle2, Eye, FileText, Loader2 } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime } from "@/lib/format"
import {
  useGenerateInvoice,
  usePaymentProofPreview,
  usePayments,
  useVerifyPayment,
} from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import type { Tables } from "@/types/database"

export function AdminPaymentsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [selectedPayment, setSelectedPayment] = useState<Tables<"payments"> | null>(null)
  const payments = usePayments({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 50,
  })
  const verifyPayment = useVerifyPayment()
  const generateInvoice = useGenerateInvoice()
  const proofPreview = usePaymentProofPreview()

  if (!organizationId) {
    return <EmptyState title="Organization access required" message="Payments need an assigned organization." />
  }

  const pendingPayments = payments.data?.data.filter((payment) => payment.status === "pending") ?? []
  const verifiedPayments = payments.data?.data.filter((payment) => payment.status === "verified") ?? []

  async function confirmVerification() {
    if (!organizationId || !selectedPayment) {
      return
    }

    const verified = await verifyPayment.mutateAsync({
      organizationId,
      paymentId: selectedPayment.id,
      idempotencyKey: `verify-${selectedPayment.id}`,
    })

    if (verified.monthly_fee_record_id && !verified.invoice_id) {
      await generateInvoice.mutateAsync({
        organizationId,
        monthlyFeeRecordId: verified.monthly_fee_record_id,
      })
    }

    await payments.refetch()
    toast.success("Payment verified.")
    setSelectedPayment(null)
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
        description="Review resident UPI submissions, verify payments, and generate invoices where fee records exist."
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
            <EmptyState title="No payments found" message="Resident UPI submissions will appear here." />
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
                        disabled={payment.status === "verified" || verifyPayment.isPending}
                        onClick={() => setSelectedPayment(payment)}
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Verify
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

      {verifyPayment.isPending || generateInvoice.isPending ? (
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
