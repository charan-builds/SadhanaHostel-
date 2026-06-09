"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { motion, type Variants } from "framer-motion"
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  CreditCard,
  IndianRupee,
  Loader2,
  QrCode,
  ReceiptText,
  UploadCloud,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
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
  usePaymentSettings,
  useResidentPaymentLedger,
  useSubmitUpiPaymentWithProof,
} from "@/hooks"
import { useMounted } from "@/hooks/use-mounted"
import { FrontendApiError, createRequestId } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format"
import {
  UPI_PAYMENT_APPS,
  buildHostelPaymentNote,
  buildHostelPaymentReference,
  buildUpiPaymentLink,
} from "@/lib/payments/upi-links"
import { useRealtimePayments } from "@/lib/realtime"
import type { UploadProgress } from "@/sdk"
import type { Tables } from "@/types/database"

const quickPaySchema = z.object({
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
})

type QuickPayInput = z.input<typeof quickPaySchema>
type QuickPayValues = z.output<typeof quickPaySchema>
type PaymentRecord = Tables<"payments">

const reveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

export function ResidentQuickPayClient() {
  const mounted = useMounted()
  const { organizationId, session } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const hostelId = resident.data?.hostel_id ?? session?.hostelIds[0]
  const paymentSettings = usePaymentSettings(
    organizationId && hostelId ? { organizationId, hostelId } : undefined
  )
  const ledger = useResidentPaymentLedger(
    organizationId
      ? {
          organizationId,
          residentId: resident.data?.id,
        }
      : undefined
  )
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [submittedPayment, setSubmittedPayment] = useState<PaymentRecord | null>(null)
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() =>
    createRequestId()
  )
  const [qrRequested, setQrRequested] = useState(false)
  const successRef = useRef<HTMLDivElement | null>(null)
  const proofInputRef = useRef<HTMLInputElement | null>(null)
  const submitUpiPayment = useSubmitUpiPaymentWithProof({ onProgress: setUploadProgress })

  useRealtimePayments({
    enabled: Boolean(organizationId && resident.data?.id),
    residentId: resident.data?.id,
  })

  const currentDueTotal = ledger.data?.totals.currentDue ?? 0
  const pendingVerificationTotal = ledger.data?.totals.pendingVerification ?? 0
  const primaryDueRecord = ledger.data?.primaryDueRecord
  const billing = ledger.data?.billing
  const dueDate = primaryDueRecord?.due_date ?? billing?.currentDueDate ?? billing?.nextDueDate ?? null
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
    payableDue > 0 ? payableDue : resident.data?.monthly_fee_amount ?? 0

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickPayInput, unknown, QuickPayValues>({
    resolver: zodResolver(quickPaySchema),
    mode: "onBlur",
    shouldFocusError: true,
    values: {
      amount: suggestedAmount,
      transactionId: "",
      notes: "",
    },
  })

  const amountRegistration = register("amount", {
    onChange: () => {
      setQrRequested(false)
    },
  })
  const transactionRegistration = register("transactionId")
  const notesRegistration = register("notes")
  const watchedAmount = useWatch({ control, name: "amount" })
  const watchedNotes = useWatch({ control, name: "notes" })
  const preparedPaymentAmount =
    typeof watchedAmount === "number" && Number.isFinite(watchedAmount)
      ? Number(watchedAmount)
      : typeof watchedAmount === "string" && watchedAmount.trim() !== ""
        ? Number(watchedAmount)
        : 0
  const hasPreparedAmount = Number.isFinite(preparedPaymentAmount) && preparedPaymentAmount > 0

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
      mounted && qrRequested
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
      qrRequested,
      upiPaymentNote,
    ]
  )

  useEffect(() => {
    if (submittedPayment) {
      successRef.current?.focus()
    }
  }, [submittedPayment])

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization access pending"
        message="Ask an admin to complete your account assignment."
      />
    )
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

  const isAdvancePayment = payableDue <= 0
  const isPartialPayment = payableDue > 0 && preparedPaymentAmount > 0 && preparedPaymentAmount < payableDue
  const activeStep = submittedPayment
    ? 4
    : proofFile
      ? 3
      : qrRequested
        ? 2
        : hasPreparedAmount
          ? 1
          : 0

  async function generateQr() {
    const isValid = await trigger("amount")
    if (!isValid) {
      return
    }

    setQrRequested(true)
  }

  async function submitPayment(values: QuickPayValues) {
    if (!organizationId || !resident.data || !hostelId) {
      return
    }

    if (!proofFile) {
      setError("root", {
        message: "Upload a payment screenshot before submitting.",
      })
      proofInputRef.current?.focus()
      return
    }

    if (!mounted || !qrRequested) {
      setError("root", {
        message: "Generate the exact amount QR before submitting payment proof.",
      })
      return
    }

    if (!isAdvancePayment && values.amount > payableDue) {
      setError("root", {
        message: `You can pay up to ${formatCurrency(payableDue)} now. Reduce the amount or use Payment Center for finance help.`,
      })
      return
    }

    try {
      const payment = await submitUpiPayment.mutateAsync({
        input: {
          organizationId,
          hostelId,
          residentId: resident.data.id,
          monthlyFeeRecordId: ledger.data?.primaryDueRecord?.id ?? undefined,
          amount: values.amount,
          method: "upi",
          transactionId: values.transactionId || undefined,
          notes: values.notes || undefined,
          isPartial: !isAdvancePayment && values.amount < payableDue,
          isAdvance: isAdvancePayment,
          idempotencyKey: paymentIdempotencyKey,
        },
        file: proofFile,
      })

      await ledger.refetch()
      reset()
      setProofFile(null)
      setUploadProgress(null)
      setSubmittedPayment(payment)
      setPaymentIdempotencyKey(createRequestId())
      setQrRequested(false)
      toast.success("Payment submitted for verification.")
    } catch (error) {
      setError("root", {
        message:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to submit payment. Please try again.",
      })
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-6">
      <PageHeader
        title="Pay Fees"
        description="Enter amount, generate the exact UPI QR, upload proof, and submit for hostel verification."
        badge={
          payableDue > 0
            ? `${formatCurrency(payableDue)} payable now`
            : dueDate
              ? `Next due ${formatDate(dueDate)}`
              : "No open due"
        }
        actions={
          <Button asChild variant="outline">
            <Link href={"/resident/payments" as Route}>
              <ReceiptText className="size-4" aria-hidden="true" />
              Payment Center
            </Link>
          </Button>
        }
      />

      {submittedPayment ? (
        <QuickPaySuccess
          refElement={successRef}
          payment={submittedPayment}
          expectedWindow="Usually within 24 hours after hostel finance review."
        />
      ) : null}

      <QuickPayProgress activeStep={activeStep} />

      <form
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
        onSubmit={(event) => {
          void handleSubmit(submitPayment)(event)
        }}
      >
        <div className="grid gap-5">
          <motion.section variants={reveal} className="rounded-xl border bg-background p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <IndianRupee className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Step 1</p>
                <h2 className="text-lg font-semibold">Enter Amount</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Use the full payment shortcut or enter a custom amount. Partial payments are
                  marked automatically when the amount is below the payable due.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="grid gap-2">
                <Label htmlFor="quick-pay-amount">Payment amount</Label>
                <Input
                  id="quick-pay-amount"
                  inputMode="decimal"
                  type="number"
                  min={1}
                  step="0.01"
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? "quick-pay-amount-error" : "quick-pay-amount-help"}
                  {...amountRegistration}
                />
                <p id="quick-pay-amount-help" className="text-xs text-muted-foreground">
                  Current payable due is {formatCurrency(payableDue)}.
                </p>
                <PaymentFieldError id="quick-pay-amount-error" message={errors.amount?.message} />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="min-h-12 w-full md:w-auto"
                  disabled={payableDue <= 0}
                  onClick={() => {
                    setValue("amount", payableDue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    setQrRequested(false)
                  }}
                >
                  Full payment
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <QuickPayStat
                label="Amount due"
                value={formatCurrency(currentDueTotal)}
                tone={currentDueTotal > 0 ? "warning" : "success"}
              />
              <QuickPayStat
                label="Due date"
                value={dueDate ? formatDate(dueDate) : "No open due"}
                tone={dueDate ? "info" : "success"}
              />
              <QuickPayStat
                label="Pending proof"
                value={formatCurrency(pendingVerificationTotal)}
                tone={pendingVerificationTotal > 0 ? "info" : "success"}
              />
            </div>
          </motion.section>

          <motion.section variants={reveal} className="rounded-xl border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <QrCode className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Step 2</p>
                  <h2 className="text-lg font-semibold">Generate QR</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    The QR uses this amount and a fresh resident payment reference.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="lg"
                className="min-h-12"
                disabled={!hasPreparedAmount || paymentSettings.isLoading}
                onClick={() => void generateQr()}
              >
                <QrCode className="size-4" aria-hidden="true" />
                Generate QR
              </Button>
            </div>

            <QuickPayQrPanel
              isLoading={paymentSettings.isLoading}
              isError={paymentSettings.isError}
              error={paymentSettings.error}
              accountName={paymentSettings.data?.account_name}
              instructions={paymentSettings.data?.instructions}
              upiId={paymentSettings.data?.upi_id}
              upiPaymentLink={upiPaymentLink}
              paymentReference={paymentReference}
              paymentAmount={preparedPaymentAmount}
              qrRequested={qrRequested}
              onRetry={() => void paymentSettings.refetch()}
            />
          </motion.section>

          <motion.section variants={reveal} className="rounded-xl border bg-background p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <UploadCloud className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Step 3</p>
                <h2 className="text-lg font-semibold">Upload Proof</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Add the UPI screenshot. UTR/reference is optional but helps finance verify faster.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quick-pay-proof">Payment screenshot</Label>
                <Input
                  ref={proofInputRef}
                  id="quick-pay-proof"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  aria-invalid={Boolean(errors.root?.message && !proofFile)}
                  aria-describedby="quick-pay-proof-help"
                  onChange={(event) => {
                    setProofFile(event.target.files?.[0] ?? null)
                  }}
                />
                <p id="quick-pay-proof-help" className="text-xs text-muted-foreground">
                  Upload a clear screenshot after completing the UPI transfer.
                </p>
                {proofFile ? (
                  <p className="text-sm font-medium text-success-foreground">
                    Selected: {proofFile.name}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="quick-pay-transaction">UPI reference / UTR optional</Label>
                <Input
                  id="quick-pay-transaction"
                  placeholder="Example: 4168XXXXXX"
                  aria-invalid={Boolean(errors.transactionId)}
                  aria-describedby={
                    errors.transactionId
                      ? "quick-pay-transaction-error"
                      : "quick-pay-transaction-help"
                  }
                  {...transactionRegistration}
                />
                <p id="quick-pay-transaction-help" className="text-xs text-muted-foreground">
                  Leave blank if your app did not show a reference yet.
                </p>
                <PaymentFieldError
                  id="quick-pay-transaction-error"
                  message={errors.transactionId?.message}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="quick-pay-notes">Notes optional</Label>
                <Textarea
                  id="quick-pay-notes"
                  rows={3}
                  placeholder="Anything finance should know?"
                  aria-invalid={Boolean(errors.notes)}
                  aria-describedby={errors.notes ? "quick-pay-notes-error" : undefined}
                  {...notesRegistration}
                />
                <PaymentFieldError id="quick-pay-notes-error" message={errors.notes?.message} />
              </div>
            </div>
          </motion.section>
        </div>

        <motion.aside
          variants={reveal}
          className="sticky bottom-20 z-20 h-fit rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur lg:top-6 lg:bottom-auto"
          aria-label="Quick payment summary"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Ready to submit</p>
              <p className="mt-1 text-3xl font-semibold">
                {formatCurrency(hasPreparedAmount ? preparedPaymentAmount : suggestedAmount)}
              </p>
            </div>
            <StatusBadge
              status={
                submittedPayment
                  ? "submitted"
                  : proofFile
                    ? "proof ready"
                    : qrRequested
                      ? "qr ready"
                      : "amount needed"
              }
            />
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <SummaryRow label="Due date" value={dueDate ? formatDate(dueDate) : "No open due"} />
            <SummaryRow
              label="Mode"
              value={isAdvancePayment ? "Advance payment" : isPartialPayment ? "Partial payment" : "Full due payment"}
            />
            <SummaryRow label="Reference" value={paymentReference} />
          </div>

          {errors.root?.message ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errors.root.message}
            </div>
          ) : null}

          {uploadProgress ? (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              Uploading proof: {uploadProgress.percent}%
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-4 min-h-14 w-full text-base"
            disabled={isSubmitting || submitUpiPayment.isPending || !proofFile || !qrRequested}
          >
            {isSubmitting || submitUpiPayment.isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Wallet className="size-5" aria-hidden="true" />
            )}
            Submit Payment
          </Button>

          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            Step 4: Submit. Dues reduce after admin verification.
          </p>
        </motion.aside>
      </form>
    </motion.div>
  )
}

function QuickPayProgress({ activeStep }: { activeStep: number }) {
  const steps = [
    { label: "Enter Amount", icon: IndianRupee },
    { label: "Generate QR", icon: QrCode },
    { label: "Upload Proof", icon: UploadCloud },
    { label: "Submit", icon: CreditCard },
  ] satisfies Array<{ label: string; icon: LucideIcon }>

  return (
    <motion.section
      variants={reveal}
      className="grid gap-2 sm:grid-cols-4"
      aria-label="Quick Pay progress"
    >
      {steps.map((step, index) => {
        const Icon = step.icon
        const complete = activeStep > index
        const current = activeStep === index

        return (
          <div
            key={step.label}
            className={
              complete
                ? "flex min-h-16 items-center gap-3 rounded-xl border border-success/25 bg-success-surface p-3 text-success-foreground shadow-sm"
                : current
                  ? "flex min-h-16 items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-primary shadow-sm"
                  : "flex min-h-16 items-center gap-3 rounded-xl border bg-background p-3 text-muted-foreground shadow-sm"
            }
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80 ring-1 ring-white/70">
              {complete ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <Icon className="size-4" aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold">
                Step {index + 1}
              </p>
              <p className="mt-0.5 text-xs">{step.label}</p>
            </div>
          </div>
        )
      })}
    </motion.section>
  )
}

function QuickPayQrPanel({
  isLoading,
  isError,
  error,
  accountName,
  instructions,
  upiId,
  upiPaymentLink,
  paymentReference,
  paymentAmount,
  qrRequested,
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
  qrRequested: boolean
  onRetry: () => void
}) {
  const [exactAmountQrUrl, setExactAmountQrUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (!upiPaymentLink) {
      return
    }

    import("qrcode")
      .then((module) =>
        module.default.toDataURL(upiPaymentLink, {
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

  if (isLoading) {
    return (
      <div className="mt-5">
        <LoadingState variant="cards" rows={1} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mt-5">
        <APIErrorState
          title="Payment account unavailable"
          error={error}
          onRetry={onRetry}
        />
      </div>
    )
  }

  if (!accountName) {
    return (
      <div className="mt-5">
        <EmptyState
          title="Payment account unavailable"
          message="Contact hostel administration before making a payment."
        />
      </div>
    )
  }

  if (!qrRequested) {
    return (
      <div className="mt-5 rounded-xl border bg-muted/25 p-5 text-sm text-muted-foreground">
        Enter an amount and tap Generate QR. This keeps the payment flow focused and prevents
        proof upload before the exact amount is ready.
      </div>
    )
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="flex aspect-square items-center justify-center rounded-xl border bg-white/80 p-3 shadow-inner">
        {displayQrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayQrUrl}
            alt={`Exact UPI QR for ${formatCurrency(paymentAmount)}`}
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
        <div className="rounded-lg border bg-success-surface p-3 text-sm leading-6 text-success-foreground">
          QR generated for {formatCurrency(paymentAmount)}. Pay from your UPI app, then upload
          the screenshot below.
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {UPI_PAYMENT_APPS.map((app) => (
              <Button key={app.id} asChild size="sm" variant="outline">
                <a
                  href={upiPaymentLink}
                  aria-label={`Open ${app.label} for ${formatCurrency(paymentAmount)}`}
                  onClick={() =>
                    toast.info("Complete payment in your UPI app, then upload proof here.")
                  }
                >
                  {app.label}
                </a>
              </Button>
            ))}
          </div>
        ) : null}

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
    </div>
  )
}

function QuickPaySuccess({
  refElement,
  payment,
  expectedWindow,
}: {
  refElement: RefObject<HTMLDivElement | null>
  payment: PaymentRecord
  expectedWindow: string
}) {
  return (
    <motion.section
      ref={refElement}
      tabIndex={-1}
      variants={reveal}
      role="status"
      aria-live="polite"
      className="rounded-xl border border-success/30 bg-success-surface p-5 text-success-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-success/50"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/70 ring-1 ring-success/20">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Payment Submitted</h2>
            <p className="mt-1 text-sm leading-6 opacity-85">
              Your proof is saved and waiting for hostel finance verification.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="bg-background text-foreground">
          <Link href={"/resident/payments" as Route}>
            View Status
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SuccessMetric label="Amount" value={formatCurrency(payment.amount)} />
        <SuccessMetric label="Submission Time" value={formatDateTime(payment.created_at)} />
        <SuccessMetric label="Status" value="Verification Pending" />
        <SuccessMetric label="Expected Verification Window" value={expectedWindow} />
      </div>
    </motion.section>
  )
}

function QuickPayStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "success" | "warning" | "info"
}) {
  const toneClassName = {
    success: "border-success/25 bg-success-surface text-success-foreground",
    warning: "border-warning/25 bg-warning-surface text-warning-foreground",
    info: "border-primary/20 bg-primary/5 text-primary",
  }[tone]

  return (
    <div className={`rounded-xl border p-3 ${toneClassName}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  )
}

function SuccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-success/20 bg-background/65 p-3 text-foreground">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5">{value}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/25 p-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[12rem] truncate text-right font-medium">{value}</span>
    </div>
  )
}

function PaymentFieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null
  }

  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )
}
