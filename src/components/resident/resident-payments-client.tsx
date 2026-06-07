"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { motion, type Variants } from "framer-motion"
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  IndianRupee,
  Loader2,
  MessageCircle,
  QrCode,
  ReceiptText,
  Smartphone,
  Sparkles,
  TrendingUp,
  UploadCloud,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import QRCode from "qrcode"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { hostelConfig } from "@/constants/hostel"
import {
  useCurrentResident,
  useInvoiceDownloadUrl,
  usePaymentSettings,
  usePayments,
  useResidentPaymentLedger,
  useSubmitUpiPaymentWithProof,
} from "@/hooks"
import { useMounted } from "@/hooks/use-mounted"
import { FrontendApiError, createRequestId } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format"
import { buildPaymentSupportMessage, buildWhatsappUrl } from "@/lib/operations/whatsapp"
import {
  UPI_PAYMENT_APPS,
  buildHostelPaymentNote,
  buildHostelPaymentReference,
  buildUpiPaymentLink,
} from "@/lib/payments/upi-links"
import { useRealtimePayments } from "@/lib/realtime"
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

type PaymentInput = z.input<typeof paymentSchema>
type PaymentValues = z.output<typeof paymentSchema>
type PaymentRecord = Tables<"payments">

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const reveal: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
  },
}

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
  const [submittedPayment, setSubmittedPayment] = useState<PaymentRecord | null>(null)
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() =>
    createRequestId()
  )
  const submitUpiPayment = useSubmitUpiPaymentWithProof({ onProgress: setUploadProgress })

  useRealtimePayments({
    enabled: Boolean(organizationId && resident.data?.id),
    residentId: resident.data?.id,
  })

  const currentDueTotal = ledger.data?.totals.currentDue ?? 0
  const pendingVerificationTotal = ledger.data?.totals.pendingVerification ?? 0
  const primaryDueRecord = ledger.data?.primaryDueRecord
  const billing = ledger.data?.billing
  const nextDueDate = billing?.nextDueDate ?? null
  const primaryPendingVerification =
    ledger.data?.payments
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
  const rejectedPayments =
    payments.data?.data.filter((payment) => payment.status === "failed") ?? []

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
  const currentPaymentAmount = preparedPaymentAmount > 0 ? preparedPaymentAmount : suggestedAmount
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

  const paymentHistory = payments.data?.data ?? []
  const currentDue = currentDueTotal
  const pendingVerification = pendingVerificationTotal
  const verifiedPaid = ledger.data?.totals.verifiedPaid ?? 0
  const advancePaid = ledger.data?.totals.advanceBalance ?? 0
  const monthlyFee = resident.data.monthly_fee_amount
  const advanceLeft = Math.max(monthlyFee - advancePaid, 0)
  const dueProgress =
    monthlyFee > 0 ? Math.max(0, Math.min(100, (currentDue / monthlyFee) * 100)) : 0
  const latestPayment = paymentHistory[0]

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
      const payment = await submitUpiPayment.mutateAsync({
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

      await payments.refetch()
      await ledger.refetch()
      reset()
      setProofFile(null)
      setUploadProgress(null)
      setSubmittedPayment(payment)
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
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-6">
      <PageHeader
        title="Payments"
        description="Enter the exact amount, open UPI with that amount pre-filled, then upload proof. Dues reduce only after admin verification."
        badge={
          payableDue > 0
            ? `${formatCurrency(payableDue)} payable now`
            : nextDueDate
              ? `Next due ${formatDate(nextDueDate)}`
              : "No payable due"
        }
      />

      <PaymentStepHeader
        hasPreparedAmount={preparedPaymentAmount > 0}
        hasProof={Boolean(proofFile)}
        pendingVerification={pendingVerification}
        submittedPayment={submittedPayment}
      />

      <motion.div
        variants={reveal}
        className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-blue-700">
            <IndianRupee className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">Exact-amount QR is enabled for resident payments.</p>
            <p className="mt-1">
              The QR and UPI app buttons use the amount entered here. Automatic bank-side paid
              status still requires a payment gateway webhook; until that is connected, submitted
              payments stay in pending verification and dues reduce after admin approval.
            </p>
          </div>
        </div>
      </motion.div>

      <MobilePayableCard
        payableDue={payableDue}
        currentDue={currentDue}
        pendingVerification={pendingVerification}
        nextDueDate={nextDueDate}
        onUsePayableDue={() => {
          setValue("amount", payableDue, { shouldDirty: true, shouldValidate: true })
          setValue("isPartial", false, { shouldDirty: true, shouldValidate: true })
          setValue("isAdvance", false, { shouldDirty: true, shouldValidate: true })
        }}
      />

      <motion.section variants={reveal} className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <FeeCard
          label="Current due"
          value={formatCurrency(currentDue)}
          detail={
            payableDue > 0
              ? `${formatCurrency(payableDue)} payable after pending payments.`
              : nextDueDate
                ? `Next payment is due on ${formatDate(nextDueDate)}.`
                : "You are clear or already waiting on verification."
          }
          icon={CreditCard}
          tone="primary"
        />
        <FeeCard
          label="Monthly fee"
          value={formatCurrency(monthlyFee)}
          detail="Base monthly hostel fee."
          icon={ReceiptText}
          tone="info"
        />
        <FeeCard
          label="Pending verification"
          value={formatCurrency(pendingVerification)}
          detail="Submitted and awaiting admin review."
          icon={Sparkles}
          tone="warning"
        />
        <FeeCard
          label="Advance paid"
          value={formatCurrency(advancePaid)}
          detail={
            advanceLeft > 0
              ? `${formatCurrency(advanceLeft)} advance left.`
              : "Advance requirement covered."
          }
          icon={IndianRupee}
          tone="success"
        />
        <FeeCard
          label="Next due"
          value={nextDueDate ? formatDate(nextDueDate) : "Not scheduled"}
          detail={
            billing?.joinedOn
              ? `Monthly billing follows joined date ${formatDate(billing.joinedOn)}.`
              : "Monthly billing date is not set."
          }
          icon={AlertTriangle}
          tone={payableDue > 0 ? "warning" : "info"}
        />
        <FeeCard
          label="Verified paid"
          value={formatCurrency(verifiedPaid)}
          detail="Accepted payment total."
          icon={CheckCircle2}
          tone="success"
        />
      </motion.section>

      {ledger.isError ? (
        <APIErrorState
          title="Payment ledger unavailable"
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
        />
      ) : null}

      <motion.section variants={reveal} className="saas-surface overflow-hidden rounded-xl">
        <div className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <TrendingUp className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Due amount visualization</h2>
              <p className="text-sm text-muted-foreground">Monthly fee coverage and payment status.</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding balance</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight">{formatCurrency(currentDue)}</p>
              </div>
              <StatusBadge status={currentDue > 0 ? "pending" : "verified"} />
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-primary via-cyan-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${dueProgress}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{Math.round(dueProgress)}% of monthly fee currently due</span>
              <span>{formatCurrency(payableDue)} payable now</span>
            </div>
          </div>
        </div>
      </motion.section>

      <PaymentBreakdown
        monthlyFee={monthlyFee}
        primaryDueRecord={primaryDueRecord}
        billing={billing}
        currentDue={currentDue}
        payableDue={payableDue}
        pendingVerification={pendingVerification}
        verifiedPaid={verifiedPaid}
        advancePaid={advancePaid}
        suggestedAmount={suggestedAmount}
        onUseSuggestedAmount={() => {
          setValue("amount", suggestedAmount, { shouldDirty: true, shouldValidate: true })
          setValue("isAdvance", payableDue <= 0, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }}
        onZeroAmount={() => {
          setValue("amount", 0, { shouldDirty: true, shouldValidate: true })
          setValue("isPartial", false, { shouldDirty: true, shouldValidate: true })
          setValue("isAdvance", false, { shouldDirty: true, shouldValidate: true })
        }}
      />

      <motion.section variants={reveal} className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit(submitPayment)} className="saas-surface rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Submit UPI payment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The UPI app opens with this amount and reference. Your balance changes only after
                finance verifies the payment proof.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/15">
              UPI only
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

          {submittedPayment ? (
            <div className="mt-4 rounded-xl border border-success/30 bg-success-surface p-4 text-sm text-success-foreground">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Payment proof submitted.</p>
                  <p className="mt-1 leading-6">
                    {formatCurrency(submittedPayment.amount)} is waiting for admin verification.
                    Dues update after approval.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="grid gap-2">
                <Label htmlFor="amount">1. Enter payment amount</Label>
                <Input id="amount" type="number" {...register("amount")} />
                <p className="text-xs text-muted-foreground">
                  The QR and UPI buttons below use this exact amount:
                  {" "}
                  {preparedPaymentAmount > 0
                    ? formatCurrency(preparedPaymentAmount)
                    : "enter amount first"}.
                </p>
                <div className="flex flex-wrap gap-2">
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setValue("amount", 0, { shouldDirty: true, shouldValidate: true })
                      setValue("isPartial", false, { shouldDirty: true, shouldValidate: true })
                      setValue("isAdvance", false, { shouldDirty: true, shouldValidate: true })
                    }}
                  >
                    Set 0
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
              qrImageSignedUrl={paymentSettings.data?.qrImageSignedUrl}
              upiId={paymentSettings.data?.upi_id}
              upiPaymentLink={upiPaymentLink}
              paymentReference={paymentReference}
              paymentAmount={preparedPaymentAmount}
              variant="embedded"
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

            <details className="rounded-xl border bg-white/55 p-4">
              <summary className="min-h-11 cursor-pointer list-none text-sm font-semibold text-foreground">
                Partial or advance payment
              </summary>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-background p-3">
                    <input type="checkbox" className="size-4 accent-primary" {...register("isPartial")} />
                    Mark as partial payment
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-background p-3">
                    <input type="checkbox" className="size-4 accent-primary" {...register("isAdvance")} />
                    Mark as advance payment
                  </label>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" className="min-h-20" {...register("notes")} />
                </div>
              </div>
            </details>
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
            className="sticky bottom-20 z-10 mt-5 min-h-11 w-full shadow-lg lg:static lg:shadow-none"
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

        <PaymentTimeline
          payments={paymentHistory}
          isLoading={payments.isLoading}
          isError={payments.isError}
          error={payments.error}
          onRetry={() => void payments.refetch()}
        />
      </motion.section>

      <PaymentHistoryCards
        payments={paymentHistory}
        isLoading={payments.isLoading}
        isError={payments.isError}
        error={payments.error}
        rejectedCount={rejectedPayments.length}
        paymentSupportUrl={paymentSupportUrl}
        isDownloading={downloadInvoice.isPending}
        onRetry={() => void payments.refetch()}
        onOpenInvoice={openInvoice}
      />
    </motion.div>
  )
}

function PaymentStepHeader({
  hasPreparedAmount,
  hasProof,
  pendingVerification,
  submittedPayment,
}: {
  hasPreparedAmount: boolean
  hasProof: boolean
  pendingVerification: number
  submittedPayment: PaymentRecord | null
}) {
  const steps = [
    {
      label: "Pay",
      detail: hasPreparedAmount ? "Amount ready" : "Enter amount",
      icon: CreditCard,
      complete: hasPreparedAmount,
    },
    {
      label: "Upload proof",
      detail: hasProof ? "Screenshot selected" : "Screenshot needed",
      icon: UploadCloud,
      complete: hasProof || Boolean(submittedPayment),
    },
    {
      label: "Track verification",
      detail:
        submittedPayment || pendingVerification > 0
          ? "Pending admin review"
          : "After submission",
      icon: Clock3,
      complete: Boolean(submittedPayment),
    },
  ] satisfies Array<{
    label: string
    detail: string
    icon: LucideIcon
    complete: boolean
  }>

  return (
    <motion.section variants={reveal} className="grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => {
        const Icon = step.icon

        return (
          <div
            key={step.label}
            className="flex min-h-16 items-center gap-3 rounded-xl border bg-card/90 p-3 shadow-soft"
          >
            <span
              className={
                step.complete
                  ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-surface text-success-foreground ring-1 ring-success/20"
                  : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
              }
            >
              {step.complete ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <Icon className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {index + 1}. {step.label}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </div>
        )
      })}
    </motion.section>
  )
}

function MobilePayableCard({
  payableDue,
  currentDue,
  pendingVerification,
  nextDueDate,
  onUsePayableDue,
}: {
  payableDue: number
  currentDue: number
  pendingVerification: number
  nextDueDate: string | null
  onUsePayableDue: () => void
}) {
  return (
    <motion.section
      variants={reveal}
      className="sticky top-20 z-10 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur md:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Payable now</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(payableDue)}</p>
        </div>
        <StatusBadge status={payableDue > 0 ? "pending" : "verified"} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="rounded-lg border bg-white/60 p-2">
          <p>Current due</p>
          <p className="mt-1 font-semibold text-foreground">{formatCurrency(currentDue)}</p>
        </div>
        <div className="rounded-lg border bg-white/60 p-2">
          <p>Pending proof</p>
          <p className="mt-1 font-semibold text-foreground">
            {formatCurrency(pendingVerification)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-10 flex-1"
          disabled={payableDue <= 0}
          onClick={onUsePayableDue}
        >
          Pay due
        </Button>
        <span className="text-xs text-muted-foreground">
          {nextDueDate ? formatDate(nextDueDate) : "No next due"}
        </span>
      </div>
    </motion.section>
  )
}

function PaymentBreakdown({
  monthlyFee,
  primaryDueRecord,
  billing,
  currentDue,
  payableDue,
  pendingVerification,
  verifiedPaid,
  advancePaid,
  suggestedAmount,
  onUseSuggestedAmount,
  onZeroAmount,
}: {
  monthlyFee: number
  primaryDueRecord: Tables<"monthly_fee_records"> | null | undefined
  billing:
    | {
        joinedOn: string | null
        currentPeriodMonth: string
        currentDueDate: string | null
        nextDueDate: string | null
        generatedCurrentDue: boolean
      }
    | undefined
  currentDue: number
  payableDue: number
  pendingVerification: number
  verifiedPaid: number
  advancePaid: number
  suggestedAmount: number
  onUseSuggestedAmount: () => void
  onZeroAmount: () => void
}) {
  const paidForDue = primaryDueRecord?.paid_amount ?? 0
  const totalForDue = primaryDueRecord?.total_amount ?? monthlyFee
  const balanceForDue = primaryDueRecord?.balance_amount ?? currentDue

  return (
    <motion.section variants={reveal} className="saas-surface rounded-xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold">Payment details before you pay</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review dues, paid fees, pending proof, and the exact amount before opening UPI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onUseSuggestedAmount}>
            Use {formatCurrency(suggestedAmount)}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onZeroAmount}>
            Set 0
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BreakdownItem label="Fee total" value={formatCurrency(totalForDue)} />
        <BreakdownItem label="Fees paid" value={formatCurrency(paidForDue)} />
        <BreakdownItem label="Dues left" value={formatCurrency(balanceForDue)} />
        <BreakdownItem label="Payable now" value={formatCurrency(payableDue)} />
        <BreakdownItem label="Pending proof" value={formatCurrency(pendingVerification)} />
        <BreakdownItem label="Verified paid" value={formatCurrency(verifiedPaid)} />
        <BreakdownItem label="Advance balance" value={formatCurrency(advancePaid)} />
        <BreakdownItem
          label="Due date"
          value={
            primaryDueRecord?.due_date
              ? formatDate(primaryDueRecord.due_date)
              : billing?.nextDueDate
                ? formatDate(billing.nextDueDate)
                : "No due record"
          }
        />
      </div>

      {primaryDueRecord ? (
        <div className="mt-4 rounded-lg border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
          Current fee period: {formatDate(primaryDueRecord.period_month)} · Status:
          {" "}
          <span className="font-medium text-foreground">{primaryDueRecord.status}</span>.
          Pending verification is shown separately because it reduces dues only after admin approval.
          {billing?.generatedCurrentDue ? " This due was opened from your monthly joined-date cycle." : null}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
          No monthly due is open.
          {billing?.nextDueDate
            ? ` Your next payment is due on ${formatDate(billing.nextDueDate)}.`
            : " Use the zero button when the hostel is starting fresh or enter an advance amount only after confirming with admin."}
        </div>
      )}
    </motion.section>
  )
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white/55 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function QrPaymentSection({
  isLoading,
  isError,
  error,
  accountName,
  instructions,
  qrImageSignedUrl,
  upiId,
  upiPaymentLink,
  paymentReference,
  paymentAmount,
  variant = "surface",
  onRetry,
}: {
  isLoading: boolean
  isError: boolean
  error: unknown
  accountName?: string
  instructions?: string | null
  qrImageSignedUrl?: string | null
  upiId?: string | null
  upiPaymentLink: string | null
  paymentReference: string
  paymentAmount: number
  variant?: "surface" | "embedded"
  onRetry: () => void
}) {
  const [exactAmountQrUrl, setExactAmountQrUrl] = useState<string | null>(null)
  const hasPreparedAmount =
    Number.isFinite(paymentAmount) && paymentAmount > 0
  const containerClassName =
    variant === "embedded"
      ? "rounded-xl border bg-white/55 p-4"
      : "saas-surface rounded-xl p-5"

  useEffect(() => {
    let active = true

    if (!upiPaymentLink) {
      return
    }

    QRCode.toDataURL(upiPaymentLink, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      color: {
        dark: "#020617",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) {
          setExactAmountQrUrl(url)
        }
      })
      .catch(() => {
        if (active) {
          setExactAmountQrUrl(null)
        }
      })

    return () => {
      active = false
    }
  }, [upiPaymentLink])
  const displayQrUrl = upiPaymentLink ? exactAmountQrUrl : null

  return (
    <div className={containerClassName}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <QrCode className="size-4 text-primary" aria-hidden="true" />
        2. Generate QR and open UPI app
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the amount first. The QR and UPI app buttons are generated only for that amount and
        reference.
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
            message="After you type the payment amount, the QR code and UPI app buttons will appear here."
          />
        </div>
      ) : accountName ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
            <div className="flex aspect-square items-center justify-center rounded-xl border border-white/70 bg-white/80 p-3 shadow-inner">
              {displayQrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayQrUrl}
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
              {displayQrUrl ? (
                <div className="rounded-lg border bg-success-surface p-3 text-xs leading-5 text-success-foreground">
                  This QR is generated for {formatCurrency(paymentAmount)} and reference
                  {" "}
                  {paymentReference}. Scan it before submitting proof.
                </div>
              ) : null}
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
                        onClick={() => toast.info("Complete payment in your UPI app, then upload the screenshot and UTR here.")}
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
            {!upiPaymentLink && qrImageSignedUrl ? (
              <p className="mt-2 leading-5">
                Exact-amount QR could not be generated. Ask finance to confirm the UPI ID before
                paying.
              </p>
            ) : null}
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

function PaymentTimeline({
  payments,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  payments: PaymentRecord[]
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
}) {
  const timeline = payments.slice(0, 5)

  return (
    <div className="saas-surface rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Payment timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Latest activity from submission to receipt.</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5">
        {isError ? (
          <APIErrorState title="Timeline unavailable" error={error} onRetry={onRetry} />
        ) : isLoading ? (
          <LoadingState variant="cards" rows={2} />
        ) : timeline.length === 0 ? (
          <EmptyState title="No timeline yet" message="Payment activity will appear after your first submission." />
        ) : (
          <div className="relative grid gap-4">
            <div className="absolute bottom-4 left-4 top-4 w-px bg-border" aria-hidden="true" />
            {timeline.map((payment, index) => (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
                className="relative grid gap-1 pl-10"
              >
                <span className="absolute left-0 top-1 flex size-8 items-center justify-center rounded-full border bg-background text-primary">
                  <ReceiptText className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                  <StatusBadge status={payment.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {payment.transaction_id ?? payment.id.slice(0, 8)} · {formatDateTime(payment.created_at)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PaymentHistoryCards({
  payments,
  isLoading,
  isError,
  error,
  rejectedCount,
  paymentSupportUrl,
  isDownloading,
  onRetry,
  onOpenInvoice,
}: {
  payments: PaymentRecord[]
  isLoading: boolean
  isError: boolean
  error: unknown
  rejectedCount: number
  paymentSupportUrl: string | null
  isDownloading: boolean
  onRetry: () => void
  onOpenInvoice: (invoiceId: string) => Promise<void>
}) {
  return (
    <motion.section variants={reveal} className="saas-surface overflow-hidden rounded-xl">
      <div className="flex flex-col gap-3 border-b bg-white/45 p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Payment history cards</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every submission visible to your resident account.
          </p>
        </div>
        <StatusBadge status={`${payments.length} records`} />
      </div>

      {isError ? (
        <div className="border-b p-4">
          <APIErrorState
            title="Payment history unavailable"
            error={error}
            onRetry={onRetry}
          />
        </div>
      ) : null}

      {rejectedCount > 0 ? (
        <div className="border-b bg-warning-surface p-4 text-sm text-warning-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                {rejectedCount} payment submission needs correction. Upload a fresh screenshot
                and add the UPI reference only if you have it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
        </div>
      ) : null}

      {isLoading ? (
        <div className="p-4">
          <LoadingState variant="cards" rows={3} />
        </div>
      ) : payments.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No payments yet" message="Submit your first payment using the form above." />
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 p-4 lg:grid-cols-2">
          {payments.map((payment) => (
            <motion.article
              key={payment.id}
              variants={reveal}
              className="rounded-xl border bg-white/60 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {payment.transaction_id ?? payment.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {formatDateTime(payment.created_at)}
                  </p>
                </div>
                <StatusBadge status={payment.status} />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-2xl font-semibold">{formatCurrency(payment.amount)}</p>
                </div>
                {payment.invoice_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isDownloading}
                    onClick={() => void onOpenInvoice(payment.invoice_id as string)}
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Receipt
                  </Button>
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    Receipt pending
                  </span>
                )}
              </div>
            </motion.article>
          ))}
        </motion.div>
      )}
    </motion.section>
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
          <p className="text-xs uppercase tracking-wide text-white/55">Receipt preview</p>
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

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-white/55">{label}</span>
      <span className="max-w-[9rem] truncate text-right text-white">{value}</span>
    </div>
  )
}

function FeeCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone: "primary" | "success" | "warning" | "info"
}) {
  const toneClassName = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    success: "bg-success-surface text-success-foreground ring-success/15",
    warning: "bg-warning-surface text-warning-foreground ring-warning/15",
    info: "bg-info-surface text-info-foreground ring-info/15",
  }[tone]

  return (
    <motion.article variants={reveal} className="saas-surface motion-lift group rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClassName}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{detail}</p>
    </motion.article>
  )
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
