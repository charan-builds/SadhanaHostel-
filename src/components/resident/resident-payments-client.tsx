"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import type { Route } from "next"
import {
  AlertTriangle,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  QrCode,
  Smartphone,
  UploadCloud,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { hostelConfig } from "@/constants/hostel"
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
  usePaymentSettings,
  usePayments,
  useResidentPaymentLedger,
  useSubmitUpiPaymentWithProof,
} from "@/hooks"
import { useMounted } from "@/hooks/use-mounted"
import { useAuth } from "@/lib/auth"
import { FrontendApiError, createRequestId } from "@/lib/api-client"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { buildPaymentSupportMessage, buildWhatsappUrl } from "@/lib/operations/whatsapp"
import {
  buildHostelPaymentNote,
  buildHostelPaymentReference,
  buildUpiPaymentLink,
  UPI_PAYMENT_APPS,
} from "@/lib/payments/upi-links"
import { useRealtimePayments } from "@/lib/realtime"
import type { UploadProgress } from "@/sdk"

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  transactionId: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "UPI reference is required.")
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9._/-]+$/, "Enter a valid UPI reference."),
  notes: z.string().trim().max(1000).optional(),
  isPartial: z.boolean().default(false),
  isAdvance: z.boolean().default(false),
})

type PaymentInput = z.input<typeof paymentSchema>
type PaymentValues = z.output<typeof paymentSchema>

export function ResidentPaymentsClient() {
  const mounted = useMounted()
  const { organizationId, session } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const paymentSettings = usePaymentSettings(
    organizationId && hostelId ? { organizationId, hostelId } : undefined
  )
  const ledger = useResidentPaymentLedger(
    organizationId ? { organizationId } : undefined
  )
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
    createRequestId()
  )
  const submitUpiPayment = useSubmitUpiPaymentWithProof({ onProgress: setUploadProgress })
  useRealtimePayments({
    enabled: Boolean(organizationId && resident.data?.id),
    residentId: resident.data?.id,
  })
  const suggestedAmount =
    ledger.data?.totals.currentDue && ledger.data.totals.currentDue > 0
      ? ledger.data.totals.currentDue
      : resident.data?.monthly_fee_amount ?? 0
  const rejectedPayments =
    payments.data?.data.filter((payment) => payment.status === "failed") ?? []

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput, unknown, PaymentValues>({
    resolver: zodResolver(paymentSchema),
    values: {
      amount: suggestedAmount,
      transactionId: "",
      notes: "",
      isPartial: false,
      isAdvance: false,
    },
  })
  const watchedAmount = useWatch({ control, name: "amount" })
  const watchedNotes = useWatch({ control, name: "notes" })
  const currentPaymentAmount = isPaymentAmountValue(watchedAmount)
    ? watchedAmount
    : suggestedAmount
  const paymentReference = useMemo(
    () =>
      mounted
        ? buildHostelPaymentReference({
            admissionNumber: resident.data?.admission_number,
            idempotencyKey: paymentIdempotencyKey,
          })
        : "Generating reference",
    [mounted, paymentIdempotencyKey, resident.data?.admission_number]
  )
  const upiPaymentNote = useMemo(
    () =>
      buildHostelPaymentNote({
        hostelName: paymentSettings.data?.account_name ?? hostelConfig.name,
        residentName: resident.data?.full_name,
        admissionNumber: resident.data?.admission_number,
        reference: paymentReference,
        notes: typeof watchedNotes === "string" ? watchedNotes : undefined,
      }),
    [
      paymentReference,
      paymentSettings.data?.account_name,
      resident.data?.admission_number,
      resident.data?.full_name,
      watchedNotes,
    ]
  )
  const upiPaymentLink = useMemo(
    () =>
      mounted
        ? buildUpiPaymentLink({
            upiId: paymentSettings.data?.upi_id,
            payeeName: paymentSettings.data?.account_name,
            amount: currentPaymentAmount,
            transactionReference: paymentReference,
            note: upiPaymentNote,
          })
        : null,
    [
      mounted,
      paymentReference,
      paymentSettings.data?.account_name,
      paymentSettings.data?.upi_id,
      currentPaymentAmount,
      upiPaymentNote,
    ]
  )
  const paymentSupportUrl = buildWhatsappUrl({
    phone: hostelConfig.contact.whatsapp,
    message: buildPaymentSupportMessage({
      residentName: resident.data?.full_name,
      admissionNumber: resident.data?.admission_number,
      amount: currentPaymentAmount,
      reference: paymentReference,
      issue: rejectedPayments.length ? "Payment was rejected, I need correction help." : undefined,
    }),
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

    if (!mounted) {
      setError("root", {
        message: "Payment reference is still being prepared. Retry in a moment.",
      })
      return
    }

    try {
      await submitUpiPayment.mutateAsync({
        input: {
          organizationId,
          hostelId: resident.data.hostel_id,
          residentId: resident.data.id,
          monthlyFeeRecordId: ledger.data?.primaryDueRecord?.id ?? undefined,
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
      await ledger.refetch()
      reset()
      setProofFile(null)
      setUploadProgress(null)
      setPaymentIdempotencyKey(createRequestId())
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

    try {
      const result = await downloadInvoice.mutateAsync({
        organizationId,
        invoiceId,
        expiresInSeconds: 900,
      })
      window.open(result.signedUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to open invoice. Please retry."
      )
    }
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
              <div className="mt-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={"/resident/support?category=payment" as Route}>
                    Get payment help
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="size-4" aria-hidden="true" />
                Hostel payment account
              </div>
              {paymentSettings.isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Loading payment instructions...</p>
              ) : paymentSettings.isError ? (
                <APIErrorState
                  title="Payment instructions unavailable"
                  error={paymentSettings.error}
                  onRetry={() => void paymentSettings.refetch()}
                />
              ) : paymentSettings.data ? (
                <div className="mt-3 grid gap-3">
                  {upiPaymentLink ? (
                    <div className="grid gap-3 rounded-lg border bg-background p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Smartphone className="size-4" aria-hidden="true" />
                        Pay directly with UPI app
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {UPI_PAYMENT_APPS.map((app) => (
                          <Button key={app.id} asChild size="sm" variant="outline">
                            <a
                              href={upiPaymentLink}
                              onClick={() => toast.info("Complete payment in your UPI app, then upload the screenshot and UTR here.")}
                            >
                              {app.label}
                            </a>
                          </Button>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span className="break-all">Payment note: {upiPaymentNote}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void navigator.clipboard.writeText(paymentReference)
                            toast.success("Payment reference copied.")
                          }}
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                          Copy reference
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {paymentSettings.data.qrImageSignedUrl ? (
                    // Signed URLs are short-lived and generated server-side.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={paymentSettings.data.qrImageSignedUrl}
                      alt="Hostel UPI QR code"
                      className="h-44 w-44 rounded-lg border bg-background object-contain p-2"
                    />
                  ) : null}
                  <div className="grid gap-1 text-sm">
                    <p className="font-medium">{paymentSettings.data.account_name}</p>
                    {paymentSettings.data.upi_id ? (
                      <button
                        type="button"
                        className="flex w-fit items-center gap-2 rounded-md border bg-background px-2 py-1 text-left"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            paymentSettings.data?.upi_id ?? ""
                          )
                          toast.success("UPI ID copied.")
                        }}
                      >
                        <span>{paymentSettings.data.upi_id}</span>
                        <Copy className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                    {paymentSettings.data.instructions ? (
                      <p className="text-muted-foreground">
                        {paymentSettings.data.instructions}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Payment account is not configured yet. Contact hostel administration before paying.
                </p>
              )}
            </div>
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
            disabled={isSubmitting || submitUpiPayment.isPending || !paymentSettings.data}
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
          {ledger.isError ? (
            <APIErrorState
              title="Payment ledger unavailable"
              error={ledger.error}
              onRetry={() => void ledger.refetch()}
            />
          ) : null}
          <Summary label="Current due" value={formatCurrency(ledger.data?.totals.currentDue ?? 0)} />
          <Summary label="Monthly fee" value={formatCurrency(resident.data.monthly_fee_amount)} />
          <Summary
            label="Pending verification"
            value={formatCurrency(ledger.data?.totals.pendingVerification ?? 0)}
          />
          <Summary
            label="Verified paid"
            value={formatCurrency(ledger.data?.totals.verifiedPaid ?? 0)}
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
        {payments.isError ? (
          <div className="border-b p-4">
            <APIErrorState
              title="Payment history unavailable"
              error={payments.error}
              onRetry={() => void payments.refetch()}
            />
          </div>
        ) : null}
        {rejectedPayments.length > 0 ? (
          <div className="border-b bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>
                  {rejectedPayments.length} payment submission needs correction. Check the UPI reference and upload a fresh screenshot.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="bg-background">
                <Link href={"/resident/support?category=payment" as Route}>
                  Ask finance
                </Link>
              </Button>
              {paymentSupportUrl ? (
                <Button asChild variant="outline" size="sm" className="bg-background">
                  <a href={paymentSupportUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    WhatsApp finance
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
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

function isPaymentAmountValue(value: unknown): value is string | number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value === "string") {
    return value.trim().length > 0
  }

  return false
}
