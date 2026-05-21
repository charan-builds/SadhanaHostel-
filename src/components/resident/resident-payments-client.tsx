"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Download, Loader2, UploadCloud } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useCurrentResident,
  useInvoiceDownloadUrl,
  usePayments,
  useSubmitUpiPaymentWithProof,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { FrontendApiError } from "@/lib/api-client"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { useRealtimePayments } from "@/lib/realtime"
import type { UploadProgress } from "@/sdk"

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  transactionId: z.string().trim().min(3, "UPI reference is required.").max(120),
  notes: z.string().trim().max(1000).optional(),
  isPartial: z.boolean().default(false),
  isAdvance: z.boolean().default(false),
})

type PaymentInput = z.input<typeof paymentSchema>
type PaymentValues = z.output<typeof paymentSchema>

export function ResidentPaymentsClient() {
  const { organizationId, session } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const payments = usePayments({
    organizationId: organizationId ?? "",
    hostelId,
    residentId: resident.data?.id,
    page: 1,
    pageSize: 50,
  })
  const downloadInvoice = useInvoiceDownloadUrl()
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  )
  const submitUpiPayment = useSubmitUpiPaymentWithProof({ onProgress: setUploadProgress })
  useRealtimePayments({ enabled: Boolean(organizationId) })

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput, unknown, PaymentValues>({
    resolver: zodResolver(paymentSchema),
    values: {
      amount: resident.data?.monthly_fee_amount ?? 0,
      transactionId: "",
      notes: "",
      isPartial: false,
      isAdvance: false,
    },
  })

  if (!organizationId) {
    return <EmptyState title="Organization access pending" message="Ask an admin to complete your account assignment." />
  }

  if (resident.isLoading) {
    return <LoadingState variant="cards" />
  }

  if (resident.error || !resident.data) {
    return (
      <APIErrorState
        title="Resident profile not linked"
        message="Your account is not connected to a resident profile."
        onRetry={() => void resident.refetch()}
      />
    )
  }

  async function submitPayment(values: PaymentValues) {
    if (!organizationId || !resident.data) {
      return
    }

    if (!proofFile) {
      setError("root", {
        message: "Payment screenshot is required before submitting a UPI payment.",
      })
      return
    }

    try {
      await submitUpiPayment.mutateAsync({
        input: {
          organizationId,
          hostelId: resident.data.hostel_id,
          residentId: resident.data.id,
          amount: values.amount,
          method: "upi",
          transactionId: values.transactionId,
          notes: values.notes || undefined,
          isPartial: values.isPartial,
          isAdvance: values.isAdvance,
          idempotencyKey: paymentIdempotencyKey,
        },
        file: proofFile,
      })

      await payments.refetch()
      reset()
      setProofFile(null)
      setUploadProgress(null)
      setPaymentIdempotencyKey(crypto.randomUUID())
      toast.success("Payment submitted for admin verification.")
    } catch (error) {
      setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to submit payment. Please try again.",
      })
    }
  }

  async function openInvoice(invoiceId: string) {
    if (!organizationId) {
      return
    }

    const result = await downloadInvoice.mutateAsync({
      organizationId,
      invoiceId,
      expiresInSeconds: 900,
    })
    window.open(result.signedUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Payments"
        description="Submit UPI payment references, upload proof, and track verification status."
      />

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={handleSubmit(submitPayment)} className="rounded-xl border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Submit UPI Payment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your submission remains pending until an admin verifies the reference and proof.
          </p>

          {errors.root?.message ? (
            <div className="mt-4">
              <APIErrorState title="Payment failed" message={errors.root.message} />
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" {...register("amount")} />
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transactionId">UPI reference / transaction ID</Label>
              <Input id="transactionId" {...register("transactionId")} />
              {errors.transactionId ? <p className="text-xs text-destructive">{errors.transactionId.message}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proof">Payment screenshot</Label>
              <Input
                id="proof"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
              />
              {proofFile ? <p className="text-xs text-muted-foreground">{proofFile.name}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" className="min-h-20" {...register("notes")} />
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-primary" {...register("isPartial")} />
                Mark as partial payment
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-primary" {...register("isAdvance")} />
                Mark as advance payment
              </label>
            </div>
          </div>

          {submitUpiPayment.isPending ? (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${uploadProgress?.percent ?? 10}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{uploadProgress?.percent ?? 0}% uploaded</p>
            </div>
          ) : null}

          <Button
            type="submit"
            className="mt-5 w-full"
            disabled={isSubmitting || submitUpiPayment.isPending}
          >
            {isSubmitting || submitUpiPayment.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="size-4" aria-hidden="true" />
            )}
            Submit Payment
          </Button>
        </form>

        <div className="grid gap-4">
          <Summary label="Monthly fee" value={formatCurrency(resident.data.monthly_fee_amount)} />
          <Summary
            label="Pending submissions"
            value={payments.data?.data.filter((payment) => payment.status === "pending").length ?? 0}
          />
          <Summary
            label="Verified payments"
            value={payments.data?.data.filter((payment) => payment.status === "verified").length ?? 0}
          />
        </div>
      </section>

      <DataTableShell
        title="Payment History"
        description="All payment records visible to your resident account."
        empty={
          payments.data?.data.length === 0 ? (
            <EmptyState title="No payments yet" message="Submit your first payment using the form above." />
          ) : undefined
        }
      >
        {payments.isLoading ? (
          <LoadingState variant="table" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data?.data.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.transaction_id ?? payment.id.slice(0, 8)}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(payment.created_at)}</TableCell>
                  <TableCell>
                    {payment.invoice_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloadInvoice.isPending}
                        onClick={() => void openInvoice(payment.invoice_id as string)}
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                        Download
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableShell>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
