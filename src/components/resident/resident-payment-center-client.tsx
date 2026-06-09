"use client"

import { motion, type Variants } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  IndianRupee,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import {
  useCurrentResident,
  useInvoiceDownloadUrl,
  usePayments,
  useResidentPaymentLedger,
} from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime, humanizeEnum } from "@/lib/format"
import type { Tables } from "@/types/database"

type PaymentRecord = Tables<"payments">
type FeeRecord = Tables<"monthly_fee_records">
type InvoiceRecord = Tables<"invoices">

const reveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

export function ResidentPaymentCenterClient() {
  const { organizationId } = useAuth()
  const resident = useCurrentResident(organizationId ?? undefined)
  const ledger = useResidentPaymentLedger(
    organizationId
      ? {
          organizationId,
          residentId: resident.data?.id,
        }
      : undefined
  )
  const payments = usePayments({
    organizationId: organizationId ?? "",
    residentId: resident.data?.id,
    page: 1,
    pageSize: 50,
  })
  const downloadInvoice = useInvoiceDownloadUrl()

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

  const paymentHistory = payments.data?.data ?? ledger.data?.payments ?? []
  const feeRecords = ledger.data?.feeRecords ?? []
  const invoices = ledger.data?.invoices ?? []
  const latestPayment = paymentHistory[0]
  const rejectedPayments = paymentHistory.filter((payment) => payment.status === "failed")
  const currentDue = ledger.data?.totals.currentDue ?? 0
  const pendingVerification = ledger.data?.totals.pendingVerification ?? 0
  const verifiedPaid = ledger.data?.totals.verifiedPaid ?? 0
  const advanceBalance = ledger.data?.totals.advanceBalance ?? 0
  const primaryDueRecord = ledger.data?.primaryDueRecord
  const billing = ledger.data?.billing
  const nextDueDate = billing?.nextDueDate ?? primaryDueRecord?.due_date ?? null

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
        title="Payment Center"
        description="History, invoices, receipts, verification status, and fee breakdown for your resident account."
        badge={
          currentDue > 0
            ? `${formatCurrency(currentDue)} due`
            : pendingVerification > 0
              ? `${formatCurrency(pendingVerification)} under review`
              : "Payments clear"
        }
        actions={
          <Button asChild>
            <Link href={"/resident/pay-fees" as Route}>
              <IndianRupee className="size-4" aria-hidden="true" />
              Pay Fees
            </Link>
          </Button>
        }
      />

      <motion.section variants={reveal} className="rounded-xl border bg-primary/5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary ring-1 ring-primary/15">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Need to make a payment?</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use Pay Fees for the fast payment flow. This page is kept for records,
                receipts, invoices, and verification tracking.
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="min-h-12 shrink-0">
            <Link href={"/resident/pay-fees" as Route}>
              Pay Now
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </motion.section>

      {rejectedPayments.length > 0 ? (
        <motion.section
          variants={reveal}
          className="rounded-xl border border-warning/25 bg-warning-surface p-4 text-warning-foreground"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">A previous payment needs correction</p>
              <p className="mt-1 text-sm leading-6 opacity-85">
                {rejectedPayments.length} rejected payment record
                {rejectedPayments.length === 1 ? "" : "s"} found. Open support if you need
                finance help before submitting again.
              </p>
            </div>
          </div>
        </motion.section>
      ) : null}

      <motion.section variants={reveal} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PaymentCenterMetric
          icon={CreditCard}
          label="Amount due"
          value={formatCurrency(currentDue)}
          detail={nextDueDate ? `Due ${formatDate(nextDueDate)}` : "No open due date"}
          tone={currentDue > 0 ? "warning" : "success"}
        />
        <PaymentCenterMetric
          icon={ReceiptText}
          label="Pending verification"
          value={formatCurrency(pendingVerification)}
          detail="Proof submitted, waiting for admin approval"
          tone={pendingVerification > 0 ? "info" : "success"}
        />
        <PaymentCenterMetric
          icon={CheckCircle2}
          label="Verified paid"
          value={formatCurrency(verifiedPaid)}
          detail={latestPayment ? `Latest ${humanizeEnum(latestPayment.status)}` : "No payment yet"}
          tone="success"
        />
        <PaymentCenterMetric
          icon={IndianRupee}
          label="Advance balance"
          value={formatCurrency(advanceBalance)}
          detail="Amount available beyond current due"
          tone={advanceBalance > 0 ? "info" : "success"}
        />
      </motion.section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <FeeBreakdownPanel
          monthlyFee={resident.data.monthly_fee_amount}
          feeRecords={feeRecords}
          primaryDueRecord={primaryDueRecord}
          isLoading={ledger.isLoading}
          isError={ledger.isError}
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
        />
        <VerificationPanel
          payments={paymentHistory}
          isLoading={payments.isLoading}
          isError={payments.isError}
          error={payments.error}
          onRetry={() => void payments.refetch()}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <InvoicesAndReceiptsPanel
          invoices={invoices}
          payments={paymentHistory}
          isLoading={ledger.isLoading}
          isDownloading={downloadInvoice.isPending}
          onOpenInvoice={openInvoice}
        />
        <PaymentHistoryPanel
          payments={paymentHistory}
          isLoading={payments.isLoading}
          isError={payments.isError}
          error={payments.error}
          isDownloading={downloadInvoice.isPending}
          onRetry={() => void payments.refetch()}
          onOpenInvoice={openInvoice}
        />
      </section>
    </motion.div>
  )
}

function PaymentCenterMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone: "success" | "warning" | "info"
}) {
  const toneClassName = {
    success: "border-success/25 bg-success-surface text-success-foreground",
    warning: "border-warning/25 bg-warning-surface text-warning-foreground",
    info: "border-primary/20 bg-primary/5 text-primary",
  }[tone]

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm opacity-75">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-background/75 ring-1 ring-white/70">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 opacity-80">{detail}</p>
    </article>
  )
}

function FeeBreakdownPanel({
  monthlyFee,
  feeRecords,
  primaryDueRecord,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  monthlyFee: number
  feeRecords: FeeRecord[]
  primaryDueRecord: FeeRecord | null | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
}) {
  return (
    <motion.section variants={reveal} className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Fee breakdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current monthly fee records and balance status.
          </p>
        </div>
        <StatusBadge status={primaryDueRecord?.status ?? "no open due"} />
      </div>

      {isError ? (
        <div className="mt-5">
          <APIErrorState title="Fee breakdown unavailable" error={error} onRetry={onRetry} />
        </div>
      ) : isLoading ? (
        <div className="mt-5">
          <LoadingState variant="cards" rows={2} />
        </div>
      ) : feeRecords.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No fee records yet"
            message={`Your monthly fee is ${formatCurrency(monthlyFee)}. Records appear after fees are generated.`}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {feeRecords.slice(0, 5).map((record) => (
            <article key={record.id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{formatDate(record.period_month)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Due {formatDate(record.due_date)} · {humanizeEnum(record.status)}
                  </p>
                </div>
                <StatusBadge status={record.status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Total" value={formatCurrency(record.total_amount)} />
                <MiniMetric label="Paid" value={formatCurrency(record.paid_amount)} />
                <MiniMetric label="Balance" value={formatCurrency(record.balance_amount)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </motion.section>
  )
}

function VerificationPanel({
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
  const latest = payments.slice(0, 5)

  return (
    <motion.section variants={reveal} className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Verification status</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track submitted proofs until finance approves them.
          </p>
        </div>
        <ReceiptText className="size-5 text-primary" aria-hidden="true" />
      </div>

      {isError ? (
        <div className="mt-5">
          <APIErrorState title="Verification status unavailable" error={error} onRetry={onRetry} />
        </div>
      ) : isLoading ? (
        <div className="mt-5">
          <LoadingState variant="cards" rows={3} />
        </div>
      ) : latest.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No payment submissions yet"
            message="Once you submit proof from Pay Fees, verification updates appear here."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {latest.map((payment) => (
            <article key={payment.id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatCurrency(payment.amount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {formatDateTime(payment.created_at)}
                  </p>
                </div>
                <StatusBadge status={payment.status} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Reference: {payment.transaction_id ?? payment.manual_reference ?? payment.id.slice(0, 8)}
              </p>
            </article>
          ))}
        </div>
      )}
    </motion.section>
  )
}

function InvoicesAndReceiptsPanel({
  invoices,
  payments,
  isLoading,
  isDownloading,
  onOpenInvoice,
}: {
  invoices: InvoiceRecord[]
  payments: PaymentRecord[]
  isLoading: boolean
  isDownloading: boolean
  onOpenInvoice: (invoiceId: string) => Promise<void>
}) {
  const paymentReceipts = payments.filter((payment) => payment.invoice_id)

  return (
    <motion.section variants={reveal} className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Invoices and receipts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download generated financial documents.
          </p>
        </div>
        <FileText className="size-5 text-primary" aria-hidden="true" />
      </div>

      {isLoading ? (
        <div className="mt-5">
          <LoadingState variant="cards" rows={2} />
        </div>
      ) : invoices.length === 0 && paymentReceipts.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No invoices or receipts yet"
            message="Receipts are generated after payment verification."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {invoices.slice(0, 4).map((invoice) => (
            <DocumentRow
              key={invoice.id}
              title={invoice.invoice_number}
              detail={`${formatCurrency(invoice.total_amount)} · ${formatDate(invoice.issue_date)}`}
              status={invoice.status}
              isDownloading={isDownloading}
              onOpen={() => void onOpenInvoice(invoice.id)}
            />
          ))}
          {paymentReceipts.slice(0, 4).map((payment) => (
            <DocumentRow
              key={payment.id}
              title={`Receipt ${payment.transaction_id ?? payment.id.slice(0, 8)}`}
              detail={`${formatCurrency(payment.amount)} · ${formatDate(payment.created_at)}`}
              status="receipt"
              isDownloading={isDownloading}
              onOpen={() => void onOpenInvoice(payment.invoice_id as string)}
            />
          ))}
        </div>
      )}
    </motion.section>
  )
}

function PaymentHistoryPanel({
  payments,
  isLoading,
  isError,
  error,
  isDownloading,
  onRetry,
  onOpenInvoice,
}: {
  payments: PaymentRecord[]
  isLoading: boolean
  isError: boolean
  error: unknown
  isDownloading: boolean
  onRetry: () => void
  onOpenInvoice: (invoiceId: string) => Promise<void>
}) {
  return (
    <motion.section variants={reveal} className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Previous transactions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All visible resident payment records.
          </p>
        </div>
        <StatusBadge status={`${payments.length} records`} />
      </div>

      {isError ? (
        <div className="mt-5">
          <APIErrorState title="Payment history unavailable" error={error} onRetry={onRetry} />
        </div>
      ) : isLoading ? (
        <div className="mt-5">
          <LoadingState variant="cards" rows={3} />
        </div>
      ) : payments.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No previous payments"
            message="Payments submitted from Pay Fees will be listed here."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {payments.map((payment) => (
            <article key={payment.id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {payment.transaction_id ?? payment.manual_reference ?? payment.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(payment.created_at)}
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
                    type="button"
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
            </article>
          ))}
        </div>
      )}
    </motion.section>
  )
}

function DocumentRow({
  title,
  detail,
  status,
  isDownloading,
  onOpen,
}: {
  title: string
  detail: string
  status: string
  isDownloading: boolean
  onOpen: () => void
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
        <Button type="button" size="sm" variant="outline" disabled={isDownloading} onClick={onOpen}>
          <Download className="size-3.5" aria-hidden="true" />
          Open
        </Button>
      </div>
    </article>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/65 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}
