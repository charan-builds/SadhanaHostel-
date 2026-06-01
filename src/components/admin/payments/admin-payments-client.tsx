"use client"

import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
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
import { formatCurrency, formatDateTime } from "@/lib/format"
import type { Tables } from "@/types/database"

type PaymentRow = Tables<"payments">
type StatusFilter = "all" | "pending" | "verified" | "failed"

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
  const [rejectedPayment, setRejectedPayment] = useState<PaymentRow | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchTerm, setSearchTerm] = useState("")

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

  const rows = useMemo(() => payments.data?.data ?? [], [payments.data?.data])
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

  if (!organizationId) {
    return <EmptyState title="Tenant context resolving" message="Sadhana Boys Hostel context is being applied automatically." />
  }

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

  async function openPaymentProof(payment: PaymentRow) {
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
          .map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`)
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
            detail={failedPayments.length ? `${failedPayments.length} failed payments` : "Finance route ready"}
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
            </div>

            {payments.isLoading ? (
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
              <div className="overflow-x-auto">
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
              </div>
            )}
          </div>

          <PaymentTimeline payments={rows} isLoading={payments.isLoading} />
        </motion.section>

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
      </motion.div>
    </ResponsiveContainer>
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
