"use client"

import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Search,
  Settings,
  TrendingUp,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { animate, motion, type Variants } from "framer-motion"
import Link from "next/link"
import type { Route } from "next"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState, WorkflowStatus } from "@/components/system"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  usePaymentProofPreview,
  usePaymentSettings,
  usePayments,
  useRejectPayment,
  useVerifyPayment,
} from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { sanitizeCsvCell } from "@/lib/csv"
import { formatCurrency, formatDateTime } from "@/lib/format"
import type { Tables } from "@/types/database"

type PaymentRow = Tables<"payments">
type StatusFilter = "all" | "pending" | "verified" | "failed"
type PaymentOutcome = {
  tone: "success" | "warning" | "info" | "danger"
  title: string
  description: string
  paymentId?: string
}

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
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  },
}

export function AdminPaymentsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null)
  const [reviewPayment, setReviewPayment] = useState<PaymentRow | null>(null)
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null)
  const [rejectedPayment, setRejectedPayment] = useState<PaymentRow | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [rejectionError, setRejectionError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [paymentOutcome, setPaymentOutcome] = useState<PaymentOutcome | null>(null)
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

  const rows = useMemo(
    () => payments.data?.data ?? [],
    [payments.data?.data]
  )
  const paymentRecordsLoading = payments.isLoading
  const pendingPayments = rows.filter((payment) => payment.status === "pending")
  const verifiedPayments = rows.filter((payment) => payment.status === "verified")
  const failedPayments = rows.filter((payment) => payment.status === "failed")
  const totalAmount = rows.reduce((total, payment) => total + payment.amount, 0)
  const verifiedAmount = verifiedPayments.reduce((total, payment) => total + payment.amount, 0)
  const pendingAmount = pendingPayments.reduce((total, payment) => total + payment.amount, 0)

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return rows.filter((payment) => {
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter
      const haystack = [
        payment.id,
        payment.resident_id,
        payment.transaction_id,
        payment.manual_reference,
        payment.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch))
    })
  }, [rows, searchTerm, statusFilter])
  const hasActivePaymentFilters = statusFilter !== "all" || searchTerm.trim().length > 0

  if (!organizationId) {
    return <EmptyState title="Tenant context resolving" message="Sadhana Boys Hostel context is being applied automatically." />
  }

  async function confirmVerification() {
    if (!organizationId || !selectedPayment) {
      return
    }

    const targetPayment = selectedPayment

    try {
      await verifyPayment.mutateAsync({
        organizationId,
        paymentId: targetPayment.id,
        idempotencyKey: `verify-${targetPayment.id}`,
      })

      await payments.refetch()
      setPaymentOutcome({
        tone: "success",
        title: "Payment verified",
        description: `${formatCurrency(targetPayment.amount)} was verified. Invoice and receipt finalization continue through the existing server workflow.`,
        paymentId: targetPayment.id,
      })
      toast.success("Payment verified. Linked invoices are generated server-side.")
      setSelectedPayment(null)
      if (reviewPayment?.id === targetPayment.id) {
        setReviewPayment(null)
      }
    } catch (error) {
      setPaymentOutcome({
        tone: "danger",
        title: "Payment verification failed",
        description:
          error instanceof FrontendApiError
            ? error.message
            : "Unable to verify payment. Retry after checking the proof and finance state.",
        paymentId: targetPayment.id,
      })
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to verify payment."
      )
      throw error
    }
  }

  async function confirmRejection() {
    if (!organizationId || !rejectedPayment) {
      return
    }

    const targetPayment = rejectedPayment
    setRejectionError(null)

    try {
      await rejectPayment.mutateAsync({
        organizationId,
        paymentId: targetPayment.id,
        reason: rejectionReason,
      })

      await payments.refetch()
      setPaymentOutcome({
        tone: "warning",
        title: "Payment rejected",
        description: `${formatCurrency(targetPayment.amount)} was returned to the resident with a correction reason. The resident can resubmit proof from their payment screen.`,
        paymentId: targetPayment.id,
      })
      toast.success("Payment rejected and proof marked for review.")
      setRejectedPayment(null)
      setRejectionReason("")
      if (reviewPayment?.id === targetPayment.id) {
        setReviewPayment(null)
      }
    } catch (error) {
      setRejectionError(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to reject payment. Retry after checking the payment state."
      )
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to reject payment."
      )
    }
  }

  async function loadPaymentProof(payment: PaymentRow, options?: { openInNewTab?: boolean }) {
    if (!organizationId) {
      return
    }

    try {
      const result = await proofPreview.mutateAsync({
        organizationId,
        paymentId: payment.id,
        expiresInSeconds: 900,
      })

      if (options?.openInNewTab) {
        window.open(result.signedUrl, "_blank", "noopener,noreferrer")
      } else {
        setProofPreviewUrl(result.signedUrl)
      }
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to open payment proof."
      )
    }
  }

  function openPaymentProof(payment: PaymentRow) {
    void loadPaymentProof(payment, { openInNewTab: true })
  }

  function openReviewDrawer(payment: PaymentRow) {
    setReviewPayment(payment)
    setProofPreviewUrl(null)
    void loadPaymentProof(payment)
  }

  function exportVisibleRows() {
    const csv = [
      ["Payment ID", "Resident ID", "Amount", "Reference", "Status", "Created"].join(","),
      ...filteredRows.map((payment) =>
        [
          payment.id,
          payment.resident_id,
          payment.amount,
          payment.transaction_id ?? payment.manual_reference ?? "",
          payment.status,
          payment.created_at,
        ]
          .map((value) => `"${sanitizeCsvCell(value).replaceAll("\"", "\"\"")}"`)
          .join(",")
      ),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "sadhana-payments.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Payments export prepared.")
  }

  return (
    <ResponsiveContainer size="wide" className="px-0 sm:px-0">
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-6">
        <PageHeader
          title="Payments"
          description="Review resident UPI submissions, verify payments, export visible transactions, and monitor payment health."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!filteredRows.length}
                onClick={exportVisibleRows}
              >
                <ArrowDownToLine className="size-4" aria-hidden="true" />
                Export
              </Button>
              <Button asChild variant="outline">
                <Link href={"/admin/finance/payment-security" as Route}>
                  <Settings className="size-4" aria-hidden="true" />
                  Payment Security
                </Link>
              </Button>
            </div>
          }
        />

        {payments.error ? (
          <APIErrorState
            title="Payments failed to load"
            message="Unable to load payment records."
            onRetry={() => void payments.refetch()}
          />
        ) : null}

        {paymentOutcome ? (
          <WorkflowStatus
            tone={paymentOutcome.tone}
            title={paymentOutcome.title}
            description={paymentOutcome.description}
            action={
              paymentOutcome.paymentId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const payment = rows.find((item) => item.id === paymentOutcome.paymentId)
                    if (payment) {
                      openReviewDrawer(payment)
                    }
                  }}
                >
                  <Eye className="size-4" aria-hidden="true" />
                  Review payment
                </Button>
              ) : null
            }
          />
        ) : null}

        <motion.section variants={reveal} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <RevenueCard
            icon={WalletCards}
            label="Gross volume"
            value={totalAmount}
            format="currency"
            detail={`${rows.length} payments on this page`}
            tone="primary"
          />
          <RevenueCard
            icon={CheckCircle2}
            label="Verified revenue"
            value={verifiedAmount}
            format="currency"
            detail={`${verifiedPayments.length} verified payments`}
            tone="success"
          />
          <RevenueCard
            icon={Clock3}
            label="Pending review"
            value={pendingAmount}
            format="currency"
            detail={`${pendingPayments.length} submissions waiting`}
            tone="warning"
          />
          <RevenueCard
            icon={TrendingUp}
            label="Active UPI"
            value={paymentSettings.data?.upi_id ?? "Not configured"}
            detail={failedPayments.length ? `${failedPayments.length} failed payments` : "0 failed payments"}
            tone="info"
          />
        </motion.section>

        <motion.section variants={reveal} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="saas-surface overflow-hidden rounded-xl">
            <div className="border-b bg-white/45 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Transactions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stripe-style queue for proof review, verification, and rejection.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,260px)_160px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search reference or resident"
                      className="pl-9"
                      aria-label="Search payments"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                    <SelectTrigger aria-label="Filter payment status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActivePaymentFilters ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {searchTerm.trim() ? (
                    <span className="rounded-full border bg-background px-2.5 py-1">
                      Search: {searchTerm.trim()}
                    </span>
                  ) : null}
                  {statusFilter !== "all" ? (
                    <span className="rounded-full border bg-background px-2.5 py-1">
                      Status: {statusFilter}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              ) : null}
            </div>

            {paymentRecordsLoading ? (
              <div className="p-4">
                <LoadingState variant="table" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4">
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
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No matching transactions" message="Try a different reference, resident ID, or status filter." />
              </div>
            ) : (
              <>
                <div className="grid gap-3 p-4 lg:hidden">
                  {filteredRows.map((payment) => (
                    <PaymentReviewCard
                      key={payment.id}
                      payment={payment}
                      proofPending={proofPreview.isPending}
                      verifyPending={verifyPayment.isPending}
                      rejectPending={rejectPayment.isPending}
                      onOpenProof={() => openPaymentProof(payment)}
                      onVerify={() => openReviewDrawer(payment)}
                      onReject={() => {
                        setRejectedPayment(payment)
                        setRejectionReason("")
                        setRejectionError(null)
                      }}
                    />
                  ))}
                </div>
                <div className="hidden overflow-x-auto lg:block">
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
                    {filteredRows.map((payment) => (
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
                              onClick={() => openPaymentProof(payment)}
                            >
                              <Eye className="size-3.5" aria-hidden="true" />
                              Proof
                            </Button>
                            <Button
                              size="sm"
                              disabled={payment.status !== "pending" || verifyPayment.isPending}
                              onClick={() => openReviewDrawer(payment)}
                            >
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              Review
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={payment.status !== "pending" || rejectPayment.isPending}
                              onClick={() => {
                                setRejectedPayment(payment)
                                setRejectionReason("")
                                setRejectionError(null)
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
                </div>
              </>
            )}
          </div>

          <div className="grid content-start gap-4">
            <PaymentReviewQueue
              payments={pendingPayments}
              proofPending={proofPreview.isPending}
              onOpenProof={openPaymentProof}
              onReview={openReviewDrawer}
            />
            <PaymentTimeline payments={rows} isLoading={paymentRecordsLoading} />
          </div>
        </motion.section>

        <PaymentReviewSheet
          payment={reviewPayment}
          proofPreviewUrl={proofPreviewUrl}
          proofPending={proofPreview.isPending}
          verifyPending={verifyPayment.isPending}
          rejectPending={rejectPayment.isPending}
          onOpenChange={(open) => {
            if (!open) {
              setReviewPayment(null)
              setProofPreviewUrl(null)
            }
          }}
          onLoadProof={(payment) => void loadPaymentProof(payment)}
          onOpenProof={openPaymentProof}
          onVerify={(payment) => setSelectedPayment(payment)}
          onReject={(payment) => {
            setRejectedPayment(payment)
            setRejectionReason("")
            setRejectionError(null)
          }}
        />

        <ConfirmDialog
          open={Boolean(selectedPayment)}
          onOpenChange={(open) => !open && setSelectedPayment(null)}
          title="Verify payment?"
          description="Only verify after checking the uploaded payment screenshot. UPI reference is helpful when present but not compulsory."
          confirmLabel={verifyPayment.isPending ? "Verifying..." : "Verify payment"}
          onConfirm={confirmVerification}
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
                Add a clear reason so the resident can resubmit with a clearer screenshot or corrected reference if available.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="rejectionReason">Reason</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Example: UTR does not match the screenshot."
                aria-invalid={Boolean(rejectionError)}
              />
              {rejectionReason.trim().length > 0 && rejectionReason.trim().length < 6 ? (
                <p className="text-xs text-destructive">
                  Add at least 6 characters so the resident knows what to fix.
                </p>
              ) : null}
            </div>
            {rejectionError ? (
              <APIErrorState title="Payment rejection failed" message={rejectionError} />
            ) : null}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectedPayment(null)
                  setRejectionReason("")
                  setRejectionError(null)
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
      </motion.div>
    </ResponsiveContainer>
  )
}

function PaymentReviewCard({
  payment,
  proofPending,
  verifyPending,
  rejectPending,
  onOpenProof,
  onVerify,
  onReject,
}: {
  payment: PaymentRow
  proofPending: boolean
  verifyPending: boolean
  rejectPending: boolean
  onOpenProof: () => void
  onVerify: () => void
  onReject: () => void
}) {
  const reference = payment.transaction_id ?? payment.manual_reference ?? payment.id.slice(0, 8)
  const canReview = payment.status === "pending"

  return (
    <article className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {formatCurrency(payment.amount)}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Resident {payment.resident_id.slice(0, 8)}
          </p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="min-w-0 break-all text-right font-medium text-foreground">{reference}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Submitted</dt>
          <dd className="text-right text-foreground">{formatDateTime(payment.created_at)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Invoice</dt>
          <dd className="text-right text-foreground">
            {payment.invoice_id ? "Ready" : "Pending"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-2">
        {canReview ? (
          <Button
            type="button"
            className="min-h-11 flex-1"
            disabled={verifyPending}
            onClick={onVerify}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Review
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={proofPending}
            onClick={onOpenProof}
          >
            <Eye className="size-4" aria-hidden="true" />
            Proof
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-11"
              aria-label={`Open actions for payment ${payment.id.slice(0, 8)}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Payment actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={proofPending} onClick={onOpenProof}>
              <Eye className="size-4" aria-hidden="true" />
              Open proof
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canReview || verifyPending} onClick={onVerify}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Verify payment
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canReview || rejectPending} onClick={onReject}>
              <XCircle className="size-4" aria-hidden="true" />
              Reject payment
            </DropdownMenuItem>
            {payment.invoice_id ? (
              <DropdownMenuItem disabled>
                <FileText className="size-4" aria-hidden="true" />
                Invoice ready
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

function PaymentReviewQueue({
  payments,
  proofPending,
  onOpenProof,
  onReview,
}: {
  payments: PaymentRow[]
  proofPending: boolean
  onOpenProof: (payment: PaymentRow) => void
  onReview: (payment: PaymentRow) => void
}) {
  const queue = payments.slice(0, 4)

  return (
    <div className="saas-surface rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Review queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify proof only after matching amount, resident, and reference.
          </p>
        </div>
        <StatusBadge status={`${payments.length} pending`} />
      </div>

      <div className="mt-4 grid gap-3">
        {queue.length === 0 ? (
          <WorkflowStatus
            tone="success"
            title="No payment proofs waiting"
            description="The queue is clear. New resident submissions will appear here and in the transaction list."
          />
        ) : (
          queue.map((payment) => (
            <article key={payment.id} className="rounded-xl border bg-white/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {formatCurrency(payment.amount)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Resident {payment.resident_id.slice(0, 8)} · {formatDateTime(payment.created_at)}
                  </p>
                </div>
                <StatusBadge status={payment.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={payment.status !== "pending"}
                  onClick={() => onReview(payment)}
                >
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Review
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={proofPending}
                  onClick={() => onOpenProof(payment)}
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                  Proof
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function PaymentReviewSheet({
  payment,
  proofPreviewUrl,
  proofPending,
  verifyPending,
  rejectPending,
  onOpenChange,
  onLoadProof,
  onOpenProof,
  onVerify,
  onReject,
}: {
  payment: PaymentRow | null
  proofPreviewUrl: string | null
  proofPending: boolean
  verifyPending: boolean
  rejectPending: boolean
  onOpenChange: (open: boolean) => void
  onLoadProof: (payment: PaymentRow) => void
  onOpenProof: (payment: PaymentRow) => void
  onVerify: (payment: PaymentRow) => void
  onReject: (payment: PaymentRow) => void
}) {
  const canReview = payment?.status === "pending"

  return (
    <Sheet open={Boolean(payment)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {payment ? (
          <>
            <SheetHeader className="border-b p-5 text-left">
              <SheetTitle>Payment review</SheetTitle>
              <SheetDescription>
                Persistent checklist for proof, resident, amount, and finance consequences.
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-5 p-5">
              <WorkflowStatus
                tone={canReview ? "warning" : "info"}
                title={canReview ? "Ready for finance decision" : "Payment already processed"}
                description={
                  canReview
                    ? "Confirm the proof and amount before verifying. Reject with a clear correction reason if anything is mismatched."
                    : "This payment is no longer pending. Review the proof and status history before taking any further action."
                }
              />

              <section className="rounded-xl border bg-white/60 p-4">
                <h3 className="text-sm font-semibold">Resident and fee context</h3>
                <div className="mt-4 grid gap-3 text-sm">
                  <ReviewRow label="Resident" value={payment.resident_id} />
                  <ReviewRow label="Amount" value={formatCurrency(payment.amount)} />
                  <ReviewRow
                    label="Reference"
                    value={payment.transaction_id ?? payment.manual_reference ?? "Not provided"}
                  />
                  <ReviewRow
                    label="Fee record"
                    value={payment.monthly_fee_record_id ? payment.monthly_fee_record_id.slice(0, 8) : "Not linked"}
                  />
                  <ReviewRow
                    label="Invoice"
                    value={payment.invoice_id ? "Invoice ready" : "Created after verification"}
                  />
                  <ReviewRow label="Submitted" value={formatDateTime(payment.created_at)} />
                </div>
              </section>

              <section className="rounded-xl border bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Proof preview</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={proofPending}
                    onClick={() => onOpenProof(payment)}
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    Open proof
                  </Button>
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border bg-muted/35">
                  {proofPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proofPreviewUrl}
                      alt={`Payment proof for ${formatCurrency(payment.amount)}`}
                      className="max-h-[420px] w-full object-contain"
                    />
                  ) : (
                    <div className="grid min-h-56 place-items-center p-5 text-center text-sm text-muted-foreground">
                      <div>
                        <FileText className="mx-auto size-8 text-primary" aria-hidden="true" />
                        <p className="mt-2">
                          {proofPending ? "Loading proof preview..." : "Proof preview is not loaded yet."}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          disabled={proofPending}
                          onClick={() => onLoadProof(payment)}
                        >
                          {proofPending ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Eye className="size-3.5" aria-hidden="true" />
                          )}
                          Load preview
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <SheetFooter className="border-t bg-background/95">
              <Button
                type="button"
                disabled={!canReview || verifyPending}
                onClick={() => onVerify(payment)}
              >
                {verifyPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                Verify payment
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canReview || rejectPending}
                onClick={() => onReject(payment)}
              >
                <XCircle className="size-4" aria-hidden="true" />
                Reject with reason
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function RevenueCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  format,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  detail: string
  tone: "primary" | "success" | "warning" | "info"
  format?: "currency"
}) {
  const toneClassName = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    success: "bg-success-surface text-success-foreground ring-success/15",
    warning: "bg-warning-surface text-warning-foreground ring-warning/15",
    info: "bg-info-surface text-info-foreground ring-info/15",
  }[tone]

  return (
    <motion.article variants={reveal} className="saas-surface motion-lift rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">
            {typeof value === "number" ? (
              <AnimatedValue value={value} format={format} />
            ) : (
              value
            )}
          </p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClassName}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{detail}</p>
    </motion.article>
  )
}

function AnimatedValue({ value, format }: { value: number; format?: "currency" }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplayValue(latest),
    })

    return () => controls.stop()
  }, [value])

  return format === "currency"
    ? formatCurrency(Math.round(displayValue))
    : Math.round(displayValue).toLocaleString("en-IN")
}

function PaymentTimeline({
  payments,
  isLoading,
}: {
  payments: PaymentRow[]
  isLoading: boolean
}) {
  const timeline = payments.slice(0, 6)

  return (
    <div className="saas-surface rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Payment timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Recent submissions and finance states.</p>
        </div>
        <Clock3 className="size-5 text-primary" aria-hidden="true" />
      </div>
      <div className="mt-5">
        {isLoading ? (
          <LoadingState variant="cards" rows={2} />
        ) : timeline.length === 0 ? (
          <EmptyState title="No timeline yet" message="Payment activity will appear after residents submit proof." />
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
                  <WalletCards className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                  <StatusBadge status={payment.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {payment.transaction_id ?? payment.manual_reference ?? payment.id.slice(0, 8)} · {formatDateTime(payment.created_at)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
