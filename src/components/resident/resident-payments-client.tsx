"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { motion, type Variants } from "framer-motion"
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Loader2,
  MessageCircle,
  QrCode,
  ReceiptText,
  Smartphone,
  UploadCloud,
} from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { hostelConfig } from "@/constants/hostel"
import {
  useCurrentResident,
  useInvoiceDownloadUrl,
  usePaymentSettings,
  useResidentPaymentLedger,
  useSubmitUpiPaymentWithProof,
} from "@/hooks"
import { useMounted } from "@/hooks/use-mounted"
import { FrontendApiError, createRequestId } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { buildFeeDueStatus, type FeeDueStatus } from "@/lib/finance/resident-due-status"
import { formatCurrency, formatDate, formatDateTime, humanizeEnum } from "@/lib/format"
import { buildPaymentSupportMessage, buildWhatsappUrl } from "@/lib/operations/whatsapp"
import {
  UPI_PAYMENT_APPS,
  buildHostelPaymentNote,
  buildHostelPaymentReference,
  buildUpiPaymentLink,
} from "@/lib/payments/upi-links"
import { useRealtimeNotifications, useRealtimePayments } from "@/lib/realtime"
import type { UploadProgress } from "@/sdk"
import type { Tables } from "@/types/database"

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  transactionId: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined
      }

      return value
    },
    z
      .string()
      .trim()
      .toUpperCase()
      .min(6, "UPI reference must be at least 6 characters.")
      .max(64)
      .regex(/^[A-Z0-9][A-Z0-9._/-]+$/, "Enter a valid UPI reference.")
      .optional()
  ),
  notes: z.string().trim().max(1000).optional(),
  isPartial: z.boolean().default(false),
  isAdvance: z.boolean().default(false),
})

type FinanceTab = "due" | "history"
type PaymentInput = z.input<typeof paymentSchema>
type PaymentValues = z.output<typeof paymentSchema>
type PaymentRecord = Tables<"payments">
type InvoiceRecord = Tables<"invoices">
type FeeRecord = Tables<"monthly_fee_records">

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const reveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
}

export function ResidentPaymentsClient() {
  const mounted = useMounted()
  const { organizationId, session } = useAuth()
  const [activeTab, setActiveTab] = useState<FinanceTab>("due")
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const paymentSettings = usePaymentSettings(
    organizationId && hostelId ? { organizationId, hostelId } : undefined
  )
  const ledger = useResidentPaymentLedger(
    organizationId ? { organizationId } : undefined
  )
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
  useRealtimeNotifications({
    enabled: Boolean(organizationId && resident.data?.id),
    residentId: resident.data?.id,
  })

  const currentDueTotal = ledger.data?.totals.currentDue ?? 0
  const primaryDueRecord = ledger.data?.primaryDueRecord
  const billing = ledger.data?.billing
  const nextDueDate = primaryDueRecord?.due_date ?? billing?.nextDueDate ?? null
  const ledgerPayments = ledger.data?.payments ?? []
  const invoices = ledger.data?.invoices ?? []
  const primaryPendingVerification =
    ledgerPayments
      .filter(
        (payment) =>
          primaryDueRecord?.id &&
          payment.monthly_fee_record_id === primaryDueRecord.id &&
          (payment.status === "pending" || payment.status === "initiated")
      )
      .reduce((total, payment) => total + payment.amount, 0) ?? 0
  const payableDue = Math.max(
    (primaryDueRecord?.balance_amount ?? currentDueTotal) - primaryPendingVerification,
    0
  )
  const suggestedAmount =
    payableDue > 0
      ? payableDue
      : resident.data?.monthly_fee_amount ?? 0
  const rejectedPayments = ledgerPayments.filter((payment) => payment.status === "failed")
  const latestPayment = ledgerPayments[0]
  const currentDue = currentDueTotal
  const monthlyFee = resident.data?.monthly_fee_amount ?? 0
  const dueInvoice = findDueInvoice(invoices, primaryDueRecord, latestPayment)
  const dueStatus =
    nextDueDate && (currentDue > 0 || payableDue > 0)
      ? buildFeeDueStatus({
          amountDue: payableDue > 0 ? payableDue : currentDue,
          dueDate: nextDueDate,
        })
      : null
  const paymentSupportUrl = buildWhatsappUrl({
    phone: hostelConfig.contact.whatsapp,
    message: buildPaymentSupportMessage({
      residentName: resident.data?.full_name,
      admissionNumber: resident.data?.admission_number,
      amount: suggestedAmount,
      reference: paymentIdempotencyKey,
      issue: rejectedPayments.length ? "Payment was rejected, I need correction help." : undefined,
    }),
  })

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
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
  const preparedPaymentAmount = isPaymentAmountValue(watchedAmount) ? Number(watchedAmount) : 0
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
            amount: preparedPaymentAmount,
            transactionReference: paymentReference,
            note: upiPaymentNote,
          })
        : null,
    [
      mounted,
      paymentReference,
      paymentSettings.data?.account_name,
      paymentSettings.data?.upi_id,
      preparedPaymentAmount,
      upiPaymentNote,
    ]
  )

  function openPaymentSheet() {
    setValue("amount", suggestedAmount, { shouldDirty: true, shouldValidate: true })
    setValue("isAdvance", payableDue <= 0, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setPaymentSheetOpen(true)
  }

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

    if (!values.isAdvance && payableDue <= 0) {
      setError("root", {
        message:
          "Your current due is already clear or covered by pending verification. Mark this as advance payment if you still need to pay.",
      })
      return
    }

    if (!values.isAdvance && values.amount > payableDue) {
      setError("root", {
        message: `You can pay up to ${formatCurrency(payableDue)} now. Reduce the amount or mark the extra amount as advance.`,
      })
      return
    }

    if (!values.isAdvance && values.amount < payableDue && !values.isPartial) {
      setError("root", {
        message: "Mark this as a partial payment when paying less than the payable due.",
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
          transactionId: values.transactionId || undefined,
          notes: values.notes || undefined,
          isPartial: values.isPartial,
          isAdvance: values.isAdvance,
          idempotencyKey: paymentIdempotencyKey,
        },
        file: proofFile,
      })

      await ledger.refetch()
      reset()
      setProofFile(null)
      setUploadProgress(null)
      setPaymentIdempotencyKey(createRequestId())
      setPaymentSheetOpen(false)
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

  async function openInvoice(invoiceId: string | null | undefined) {
    if (!organizationId || !invoiceId) {
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
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-5">
      <PageHeader
        title="Finance"
        description="Check what is due, pay quickly, and open history only when you need details."
        badge={
          payableDue > 0
            ? `${formatCurrency(payableDue)} payable now`
            : nextDueDate
              ? `Next due ${formatDate(nextDueDate)}`
              : "No payable due"
        }
      />

      {ledger.isError ? (
        <APIErrorState
          title="Payment ledger unavailable"
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
        />
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceTab)}>
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted/70 p-1">
          <TabsTrigger className="h-11 flex-col gap-0.5 text-xs sm:h-10 sm:flex-row sm:text-sm" value="due">
            <CreditCard className="size-4" aria-hidden="true" />
            Due & Pay
          </TabsTrigger>
          <TabsTrigger className="h-11 flex-col gap-0.5 text-xs sm:h-10 sm:flex-row sm:text-sm" value="history">
            <ReceiptText className="size-4" aria-hidden="true" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="due" className="mt-5 grid gap-5">
          <DueAndPayTab
            dueStatus={dueStatus}
            dueDate={nextDueDate}
            currentDue={currentDue}
            payableDue={payableDue}
            primaryDueRecord={primaryDueRecord}
            dueInvoice={dueInvoice}
            isDownloading={downloadInvoice.isPending}
            onOpenInvoice={() => void openInvoice(dueInvoice?.id)}
            onPayNow={openPaymentSheet}
          />

          <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
            <SheetContent side="bottom" className="max-h-[90svh] overflow-y-auto rounded-t-2xl p-0 sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2">
              <SheetHeader className="px-4 pt-5 text-left">
                <SheetTitle>Pay fees</SheetTitle>
                <SheetDescription>
                  Generate UPI for the selected amount and upload proof.
                </SheetDescription>
              </SheetHeader>
          <form id="resident-payment-form" onSubmit={handleSubmit(submitPayment)} className="grid gap-5 px-4 pb-5 pt-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Submit UPI payment</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter amount, open UPI, then upload proof for finance verification.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/15">
                UPI
              </span>
            </div>

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
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Payment amount</Label>
                  <Input id="amount" type="number" inputMode="decimal" {...register("amount")} />
                  <p className="text-xs text-muted-foreground">
                    QR and UPI buttons use
                    {" "}
                    {preparedPaymentAmount > 0
                      ? formatCurrency(preparedPaymentAmount)
                      : "the amount you enter"}.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={payableDue <= 0}
                      onClick={() => {
                        setValue("amount", payableDue, { shouldDirty: true, shouldValidate: true })
                        setValue("isPartial", false, { shouldDirty: true, shouldValidate: true })
                        setValue("isAdvance", false, { shouldDirty: true, shouldValidate: true })
                      }}
                    >
                      Pay due
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setValue("amount", monthlyFee, { shouldDirty: true, shouldValidate: true })
                        setValue("isAdvance", payableDue <= 0, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                        setValue("isPartial", payableDue > monthlyFee, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }}
                    >
                      Monthly fee
                    </Button>
                  </div>
                  {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
                </div>

                <ReceiptPreview
                  reference={paymentReference}
                  amount={preparedPaymentAmount}
                  residentName={resident.data.full_name}
                  admissionNumber={resident.data.admission_number}
                  latestStatus={latestPayment?.status}
                />
              </div>

              {upiPaymentLink ? (
                <div className="rounded-lg border bg-muted/35 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Smartphone className="size-4 text-primary" aria-hidden="true" />
                    Payment note
                  </div>
                  <p className="mt-2 break-all text-xs leading-5 text-muted-foreground">{upiPaymentNote}</p>
                </div>
              ) : null}

              <QrPaymentSection
                isLoading={paymentSettings.isLoading}
                isError={paymentSettings.isError}
                error={paymentSettings.error}
                accountName={paymentSettings.data?.account_name}
                instructions={paymentSettings.data?.instructions}
                upiId={paymentSettings.data?.upi_id}
                upiPaymentLink={upiPaymentLink}
                paymentReference={paymentReference}
                paymentAmount={preparedPaymentAmount}
                onRetry={() => void paymentSettings.refetch()}
              />

              <div className="grid gap-2">
                <Label htmlFor="transactionId">UPI reference / transaction ID</Label>
                <Input id="transactionId" placeholder="Optional" {...register("transactionId")} />
                <p className="text-xs text-muted-foreground">
                  Optional. Screenshot upload is compulsory for verification.
                </p>
                {errors.transactionId ? <p className="text-xs text-destructive">{errors.transactionId.message}</p> : null}
              </div>

              <div className="grid gap-2 rounded-xl border border-dashed bg-white/55 p-4">
                <Label htmlFor="proof">Payment screenshot *</Label>
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

              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border bg-white/55 p-3">
                  <input type="checkbox" className="size-4 accent-primary" {...register("isPartial")} />
                  Mark as partial payment
                </label>
                <label className="flex items-center gap-2 rounded-lg border bg-white/55 p-3">
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
              className="mt-5 h-11 w-full"
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
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          {activeTab === "history" ? (
            <PaymentHistoryTab
              payments={ledgerPayments}
              invoices={invoices}
              isLoading={ledger.isLoading}
              isError={ledger.isError}
              error={ledger.error}
              isDownloading={downloadInvoice.isPending}
              paymentSupportUrl={paymentSupportUrl}
              rejectedCount={rejectedPayments.length}
              selectedPayment={selectedPayment}
              onSelectPayment={setSelectedPayment}
              onRetry={() => void ledger.refetch()}
              onOpenInvoice={(invoiceId) => void openInvoice(invoiceId)}
            />
          ) : null}
        </TabsContent>
      </Tabs>

      {activeTab === "due" ? (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-4 lg:hidden">
          <Button
            type="button"
            className="mx-auto h-12 w-full max-w-md shadow-lifted"
            onClick={openPaymentSheet}
          >
            <CreditCard className="size-4" aria-hidden="true" />
            Pay {formatCurrency(suggestedAmount)}
          </Button>
        </div>
      ) : null}
    </motion.div>
  )
}

function DueAndPayTab({
  dueStatus,
  dueDate,
  currentDue,
  payableDue,
  primaryDueRecord,
  dueInvoice,
  isDownloading,
  onOpenInvoice,
  onPayNow,
}: {
  dueStatus: FeeDueStatus | null
  dueDate: string | null
  currentDue: number
  payableDue: number
  primaryDueRecord: FeeRecord | null | undefined
  dueInvoice: InvoiceRecord | null
  isDownloading: boolean
  onOpenInvoice: () => void
  onPayNow: () => void
}) {
  const dueToneClassName = dueStatus?.className ?? "border-emerald-200 bg-emerald-50 text-emerald-950"

  return (
    <>
      <motion.section variants={reveal} className={`rounded-xl border p-4 sm:p-5 ${dueToneClassName}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {dueStatus?.label ?? "No current due"}
            </div>
            <p className="mt-3 text-4xl font-semibold tracking-tight">
              {formatCurrency(payableDue > 0 ? payableDue : currentDue)}
            </p>
            <p className="mt-2 text-sm">
              Due date: {dueDate ? formatDate(dueDate) : "Not scheduled"}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
            <Button type="button" className="h-11" onClick={onPayNow}>
              <CreditCard className="size-4" aria-hidden="true" />
              Pay Now
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-white/70"
              disabled={!dueInvoice || isDownloading}
              onClick={onOpenInvoice}
            >
              {isDownloading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              Download Invoice
            </Button>
          </div>
        </div>
      </motion.section>

      <PaymentProgress record={primaryDueRecord} />
    </>
  )
}

function PaymentProgress({ record }: { record: FeeRecord | null | undefined }) {
  if (!record || record.total_amount <= 0 || record.paid_amount <= 0) {
    return null
  }

  const percent = Math.min(100, Math.round((record.paid_amount / record.total_amount) * 100))

  return (
    <motion.section variants={reveal} className="rounded-xl border bg-white/80 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{formatFeeMonth(record.period_month)} Fee</p>
          <p className="mt-1 text-sm text-muted-foreground">Partial payment progress</p>
        </div>
        <StatusBadge status={record.status} />
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border bg-background/80 p-3">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="mt-1 font-semibold">{formatCurrency(record.paid_amount)}</p>
        </div>
        <div className="rounded-lg border bg-background/80 p-3">
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="mt-1 font-semibold">{formatCurrency(record.balance_amount)}</p>
        </div>
      </div>
    </motion.section>
  )
}

function PaymentHistoryTab({
  payments,
  invoices,
  isLoading,
  isError,
  error,
  isDownloading,
  paymentSupportUrl,
  rejectedCount,
  selectedPayment,
  onSelectPayment,
  onRetry,
  onOpenInvoice,
}: {
  payments: PaymentRecord[]
  invoices: InvoiceRecord[]
  isLoading: boolean
  isError: boolean
  error: unknown
  isDownloading: boolean
  paymentSupportUrl: string | null
  rejectedCount: number
  selectedPayment: PaymentRecord | null
  onSelectPayment: (payment: PaymentRecord | null) => void
  onRetry: () => void
  onOpenInvoice: (invoiceId: string | null | undefined) => void
}) {
  return (
    <motion.section variants={reveal} initial="hidden" animate="show" className="saas-surface overflow-hidden rounded-xl">
      <div className="flex items-start justify-between gap-3 border-b bg-white/45 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">Payment History</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Month, amount, status, and payment method from your resident ledger.
          </p>
        </div>
        <StatusBadge status={`${payments.length} records`} />
      </div>

      {isError ? (
        <div className="border-b p-4">
          <APIErrorState title="Payment history unavailable" error={error} onRetry={onRetry} />
        </div>
      ) : null}

      {rejectedCount > 0 ? (
        <div className="border-b bg-warning-surface p-4 text-sm text-warning-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{rejectedCount} payment submission needs correction.</p>
            </div>
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

      {isLoading ? (
        <div className="p-4">
          <LoadingState variant="cards" rows={3} />
        </div>
      ) : payments.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No payments yet" message="Submit your first payment from Due & Pay." />
        </div>
      ) : (
        <div className="grid gap-3 p-4">
          {payments.map((payment) => {
            const invoice = findPaymentInvoice(invoices, payment)

            return (
              <button
                key={payment.id}
                type="button"
                className="grid w-full gap-3 rounded-xl border bg-white/65 p-4 text-left transition hover:bg-white hover:shadow-soft sm:grid-cols-[1fr_auto] sm:items-center"
                onClick={() => onSelectPayment(payment)}
              >
                <div className="grid gap-2">
                  <div className="flex items-start justify-between gap-3 sm:justify-start">
                    <div>
                      <p className="text-sm font-semibold">{formatPaymentMonth(payment)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Method: {humanizeEnum(payment.method)}
                      </p>
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:max-w-md">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Invoice</p>
                      <p className="truncate font-medium">{invoice?.invoice_number ?? "Pending"}</p>
                    </div>
                  </div>
                </div>
                <span className="flex items-center justify-between gap-2 text-sm font-medium text-primary sm:justify-end">
                  Details
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              </button>
            )
          })}
        </div>
      )}

      <PaymentDetailDrawer
        payment={selectedPayment}
        invoice={selectedPayment ? findPaymentInvoice(invoices, selectedPayment) : null}
        isDownloading={isDownloading}
        onOpenChange={(open) => {
          if (!open) {
            onSelectPayment(null)
          }
        }}
        onOpenInvoice={onOpenInvoice}
      />
    </motion.section>
  )
}

function PaymentDetailDrawer({
  payment,
  invoice,
  isDownloading,
  onOpenChange,
  onOpenInvoice,
}: {
  payment: PaymentRecord | null
  invoice: InvoiceRecord | null
  isDownloading: boolean
  onOpenChange: (open: boolean) => void
  onOpenInvoice: (invoiceId: string | null | undefined) => void
}) {
  return (
    <Sheet open={Boolean(payment)} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto rounded-t-2xl p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2">
        <SheetHeader>
          <SheetTitle>Payment details</SheetTitle>
          <SheetDescription>
            Invoice, receipt, transaction ID, and payment date.
          </SheetDescription>
        </SheetHeader>

        {payment ? (
          <div className="grid gap-3 px-4 pb-4">
            <DetailRow label="Month" value={formatPaymentMonth(payment)} />
            <DetailRow label="Amount" value={formatCurrency(payment.amount)} />
            <DetailRow label="Status" value={humanizeEnum(payment.status)} />
            <DetailRow label="Payment method" value={humanizeEnum(payment.method)} />
            <DetailRow label="Invoice" value={invoice?.invoice_number ?? "Invoice pending"} />
            <DetailRow label="Receipt" value={payment.invoice_id ? "Generated" : "Receipt pending"} />
            <DetailRow
              label="Transaction ID"
              value={payment.transaction_id ?? payment.provider_reference ?? payment.manual_reference ?? "Not provided"}
            />
            <DetailRow label="Payment date" value={formatDateTime(payment.paid_at ?? payment.verified_at ?? payment.created_at)} />
            <DetailRow label="Notes" value={payment.notes ?? "No notes"} />
          </div>
        ) : null}

        <SheetFooter className="border-t bg-white/70">
          <Button
            type="button"
            variant="outline"
            disabled={!invoice || isDownloading}
            onClick={() => onOpenInvoice(invoice?.id)}
          >
            {isDownloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            Download Invoice
          </Button>
          <Button
            type="button"
            disabled={!payment?.invoice_id || isDownloading}
            onClick={() => onOpenInvoice(payment?.invoice_id)}
          >
            <ReceiptText className="size-4" aria-hidden="true" />
            Open Receipt
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function QrPaymentSection({
  isLoading,
  isError,
  error,
  accountName,
  instructions,
  upiId,
  upiPaymentLink,
  paymentReference,
  paymentAmount,
  onRetry,
}: {
  isLoading: boolean
  isError: boolean
  error: unknown
  accountName?: string
  instructions?: string | null
  upiId?: string | null
  upiPaymentLink: string | null
  paymentReference: string
  paymentAmount: number
  onRetry: () => void
}) {
  const [exactAmountQr, setExactAmountQr] = useState<{
    link: string
    url: string | null
  } | null>(null)
  const hasPreparedAmount =
    Number.isFinite(paymentAmount) && paymentAmount > 0
  const exactAmountQrUrl =
    exactAmountQr?.link === upiPaymentLink ? exactAmountQr.url : null

  useEffect(() => {
    let active = true

    if (!upiPaymentLink) {
      return
    }

    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(upiPaymentLink, {
          errorCorrectionLevel: "M",
          margin: 1,
          scale: 8,
          color: {
            dark: "#020617",
            light: "#ffffff",
          },
        })
      )
      .then((url) => {
        if (active) {
          setExactAmountQr({ link: upiPaymentLink, url })
        }
      })
      .catch(() => {
        if (active) {
          setExactAmountQr({ link: upiPaymentLink, url: null })
        }
      })

    return () => {
      active = false
    }
  }, [upiPaymentLink])

  return (
    <div className="rounded-xl border bg-white/55 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <QrCode className="size-4 text-primary" aria-hidden="true" />
        Generate QR and open UPI app
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        The QR and app buttons are generated for the exact amount and reference.
      </p>

      {isLoading ? (
        <div className="mt-4">
          <LoadingState variant="cards" rows={1} />
        </div>
      ) : isError ? (
        <div className="mt-4">
          <APIErrorState
            title="Payment instructions unavailable"
            error={error}
            onRetry={onRetry}
          />
        </div>
      ) : accountName && !hasPreparedAmount ? (
        <div className="mt-4">
          <EmptyState
            title="Enter amount first"
            message="QR code and UPI app buttons appear after an amount is entered."
          />
        </div>
      ) : accountName ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="flex aspect-square items-center justify-center rounded-xl border border-white/70 bg-white/80 p-3 shadow-inner">
              {exactAmountQrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={exactAmountQrUrl}
                  alt="Exact amount UPI QR code"
                  className="h-full w-full rounded-lg object-contain"
                />
              ) : (
                <div className="grid place-items-center text-center text-sm text-muted-foreground">
                  <QrCode className="mx-auto mb-2 size-10 text-primary" aria-hidden="true" />
                  Exact QR preparing
                </div>
              )}
            </div>
            <div className="grid content-start gap-3">
              <div className="rounded-lg border bg-success-surface p-3 text-xs leading-5 text-success-foreground">
                Prepared for {formatCurrency(paymentAmount)} and reference {paymentReference}.
              </div>
              <div>
                <p className="text-sm font-medium">{accountName}</p>
                {upiId ? (
                  <button
                    type="button"
                    className="mt-2 flex w-fit max-w-full items-center gap-2 rounded-lg border bg-white/70 px-3 py-2 text-left text-sm transition hover:bg-white"
                    onClick={() => {
                      void navigator.clipboard.writeText(upiId)
                      toast.success("UPI ID copied.")
                    }}
                  >
                    <span className="truncate">{upiId}</span>
                    <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {upiPaymentLink ? (
                <div className="grid grid-cols-2 gap-2">
                  {UPI_PAYMENT_APPS.map((app) => (
                    <Button key={app.id} asChild size="sm" variant="outline">
                      <a
                        href={upiPaymentLink}
                        aria-label={`Open ${app.label} for ${formatCurrency(paymentAmount)}`}
                        onClick={() => toast.info("Complete payment in your UPI app, then upload screenshot and UTR here.")}
                      >
                        {app.label}
                      </a>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/35 p-3 text-xs text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all">Reference: {paymentReference}</span>
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
                Copy
              </Button>
            </div>
            {instructions ? <p className="mt-2 leading-5">{instructions}</p> : null}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Payment account unavailable"
            message="Contact hostel administration before making a payment."
          />
        </div>
      )}
    </div>
  )
}

function ReceiptPreview({
  reference,
  amount,
  residentName,
  admissionNumber,
  latestStatus,
}: {
  reference: string
  amount: string | number
  residentName: string
  admissionNumber?: string | null
  latestStatus?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-4 text-white shadow-lifted">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-white/55">Receipt preview</p>
          <p className="mt-1 text-sm font-medium">{hostelConfig.shortName}</p>
        </div>
        <ReceiptText className="size-5 text-cyan-200" aria-hidden="true" />
      </div>
      <div className="mt-6">
        <p className="text-xs text-white/55">Amount prepared</p>
        <p className="mt-1 text-3xl font-semibold">{formatCurrency(Number(amount) || 0)}</p>
      </div>
      <div className="mt-6 grid gap-3 text-xs">
        <ReceiptRow label="Resident" value={residentName} />
        <ReceiptRow label="Admission" value={admissionNumber ?? "Not assigned"} />
        <ReceiptRow label="Reference" value={reference} />
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <span className="text-white/55">Latest status</span>
          <span className="rounded-full bg-white/10 px-2 py-1 text-white">
            {latestStatus ?? "Ready"}
          </span>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-white/55">{label}</span>
      <span className="max-w-[9rem] truncate text-right text-white">{value}</span>
    </div>
  )
}

function findDueInvoice(
  invoices: InvoiceRecord[],
  primaryDueRecord: FeeRecord | null | undefined,
  latestPayment: PaymentRecord | undefined
) {
  return (
    invoices.find(
      (invoice) =>
        invoice.monthly_fee_record_id &&
        invoice.monthly_fee_record_id === primaryDueRecord?.id
    ) ??
    invoices.find((invoice) => invoice.id === latestPayment?.invoice_id) ??
    null
  )
}

function findPaymentInvoice(invoices: InvoiceRecord[], payment: PaymentRecord) {
  return (
    invoices.find((invoice) => invoice.id === payment.invoice_id) ??
    invoices.find(
      (invoice) =>
        invoice.monthly_fee_record_id &&
        invoice.monthly_fee_record_id === payment.monthly_fee_record_id
    ) ??
    null
  )
}

function formatPaymentMonth(payment: PaymentRecord) {
  const date = payment.paid_at ?? payment.verified_at ?? payment.created_at

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

function formatFeeMonth(periodMonth: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(periodMonth))
}

function isPaymentAmountValue(value: unknown): value is string | number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value === "string") {
    const amount = Number(value)

    return Number.isFinite(amount) && amount > 0
  }

  return false
}
