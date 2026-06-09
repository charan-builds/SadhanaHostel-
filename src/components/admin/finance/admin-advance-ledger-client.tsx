"use client"

import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  useAdvanceReports,
  useAllocateAdvance,
  useRecordAdvanceDeposit,
  useResidents,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/format"

export function AdminAdvanceLedgerClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [search, setSearch] = useState("")
  const [depositResidentId, setDepositResidentId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank_transfer">("cash")
  const [transactionId, setTransactionId] = useState("")
  const [notes, setNotes] = useState("")
  const reports = useAdvanceReports(
    organizationId
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const recordDeposit = useRecordAdvanceDeposit()
  const allocateAdvance = useAllocateAdvance()
  const residents = useResidents({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 100,
  })
  const filteredLiability = useMemo(() => {
    const liability = reports.data?.reports.liability ?? []
    const query = search.trim().toLowerCase()

    if (!query) {
      return liability
    }

    return liability.filter((row) =>
      [row.residentName, row.residentId, row.coveredUntil]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  }, [reports.data?.reports.liability, search])
  const owner = reports.data?.ownerDashboard

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Finance workspace will load when organization access is ready."
      />
    )
  }

  async function submitDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!organizationId || !hostelId || !depositResidentId) {
      toast.error("Choose a resident before recording advance.")
      return
    }

    try {
      await recordDeposit.mutateAsync({
        organizationId,
        hostelId,
        residentId: depositResidentId,
        amount: Number(amount),
        paymentMode,
        transactionId,
        receivedDate: new Date().toISOString().slice(0, 10),
        notes,
      })
      setAmount("")
      setTransactionId("")
      setNotes("")
      toast.success("Advance deposit recorded and auto-allocated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record advance deposit.")
    }
  }

  async function runAllocation() {
    if (!organizationId) {
      return
    }

    try {
      const result = await allocateAdvance.mutateAsync({
        organizationId,
        hostelId,
        limit: 500,
      })
      await reports.refetch()
      toast.success(`Advance allocation processed ${result.processed} resident(s).`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Advance allocation failed.")
    }
  }

  if (reports.isLoading) {
    return <LoadingState variant="dashboard" />
  }

  if (reports.isError) {
    return (
      <APIErrorState
        title="Advance ledger failed to load"
        error={reports.error}
        onRetry={() => void reports.refetch()}
      />
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Advance Payment Ledger"
        description="Track advance deposits, automatic monthly consumption, refund liability, and checkout settlement."
        badge="Finance Source of Truth"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={reports.isFetching}
              onClick={() => void reports.refetch()}
            >
              {reports.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              disabled={allocateAdvance.isPending}
              onClick={() => void runAllocation()}
            >
              {allocateAdvance.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              Auto Allocate
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Total Advance Liability"
          value={formatCurrency(owner?.totalAdvanceLiability ?? 0)}
          icon={WalletCards}
        />
        <Metric
          label="Residents Covered"
          value={owner?.residentsCoveredByAdvance ?? 0}
          icon={CheckCircle2}
        />
        <Metric
          label="Upcoming Expiry"
          value={owner?.upcomingAdvanceExpiry.length ?? 0}
          icon={CalendarClock}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Record Advance Deposit</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void submitDeposit(event)}>
              <div className="grid gap-2">
                <Label htmlFor="resident-id">Resident</Label>
                <Select value={depositResidentId} onValueChange={setDepositResidentId}>
                  <SelectTrigger id="resident-id">
                    <SelectValue placeholder="Choose resident" />
                  </SelectTrigger>
                  <SelectContent>
                    {(residents.data?.data ?? []).map((resident) => (
                      <SelectItem key={resident.id} value={resident.id}>
                        {resident.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="advance-amount">Amount</Label>
                <Input
                  id="advance-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment-mode">Payment Mode</Label>
                <Select
                  value={paymentMode}
                  onValueChange={(value) =>
                    setPaymentMode(value as "cash" | "upi" | "bank_transfer")
                  }
                >
                  <SelectTrigger id="payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transaction-id">Transaction ID</Label>
                <Input
                  id="transaction-id"
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="advance-notes">Notes</Label>
                <Textarea
                  id="advance-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={recordDeposit.isPending}>
                {recordDeposit.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Banknote className="size-4" aria-hidden="true" />
                )}
                Save Advance
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Advance Liability Report</CardTitle>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search resident"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Consumed</TableHead>
                    <TableHead>Refunded</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Covered Until</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLiability.map((row) => (
                    <TableRow key={row.residentId}>
                      <TableCell className="font-medium">{row.residentName}</TableCell>
                      <TableCell>{formatCurrency(row.totalAdvanceReceived)}</TableCell>
                      <TableCell>{formatCurrency(row.totalAdvanceConsumed)}</TableCell>
                      <TableCell>{formatCurrency(row.totalAdvanceRefunded)}</TableCell>
                      <TableCell>{formatCurrency(row.remainingAdvanceBalance)}</TableCell>
                      <TableCell>
                        {row.coveredUntil ? (
                          <Badge variant="secondary">{row.coveredUntil}</Badge>
                        ) : (
                          "Not covered"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ReportPanel title="Advance Aging">
          {reports.data?.reports.aging.map((bucket) => (
            <ReportLine
              key={bucket.label}
              label={bucket.label}
              value={formatCurrency(bucket.amount)}
              detail={`${bucket.residentCount} resident(s)`}
            />
          ))}
        </ReportPanel>
        <ReportPanel title="Advance Utilization">
          {(reports.data?.reports.utilization ?? []).slice(0, 8).map((row) => (
            <ReportLine
              key={row.month}
              label={row.month}
              value={formatCurrency(row.consumedAmount)}
              detail={`${row.allocationCount} allocation(s)`}
            />
          ))}
        </ReportPanel>
        <ReportPanel title="Refund Report">
          {(reports.data?.reports.refunds ?? []).slice(0, 8).map((refund) => (
            <ReportLine
              key={refund.refundId}
              label={refund.residentName}
              value={formatCurrency(refund.amount)}
              detail={`${refund.status} · ${formatDate(refund.requestedAt)}`}
            />
          ))}
        </ReportPanel>
      </section>
    </ResponsiveContainer>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: LucideIcon
}) {
  return (
    <article className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </article>
  )
}

function ReportPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  )
}

function ReportLine({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/25 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}
