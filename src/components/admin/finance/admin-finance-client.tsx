"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import type { Route } from "next"
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Filter,
  IndianRupee,
  LineChart,
  Loader2,
  MessageCircle,
  PhoneCall,
  ReceiptText,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  buildFinanceTimeline,
  type CollectionPriority,
  type FinanceDashboard,
  type FinanceTimelineEvent,
  type FinanceOwnerAnalytics,
  type ResidentFinanceSummary,
} from "@/lib/finance/finance-dashboard"
import type { Tables } from "@/types/database"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime, humanizeEnum } from "@/lib/format"
import { buildWhatsappUrl } from "@/lib/operations/whatsapp"
import { cn } from "@/lib/utils"
import {
  useAdvanceLedger,
  useAllocateAdvance,
  useApplyFinancialCorrection,
  useAuditLogs,
  useFinanceDashboard,
  useCollectionFollowups,
  useCompleteCollectionFollowup,
  useCreateCollectionFollowup,
  useRunFinanceAutomation,
  useGenerateMonthlyFee,
  useRecordInPersonPayment,
  useResidentPaymentLedger,
} from "@/hooks"

type SmartFilter =
  | "all"
  | "pending"
  | "overdue"
  | "partial"
  | "advance"
  | "paid_this_month"
  | "new_joiners"
  | "no_payment_this_month"
  | "high_risk"

const smartFilters: Array<{ key: SmartFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending fees" },
  { key: "overdue", label: "Overdue" },
  { key: "partial", label: "Partial payments" },
  { key: "advance", label: "Advance holders" },
  { key: "paid_this_month", label: "Paid this month" },
  { key: "new_joiners", label: "New joiners" },
  { key: "no_payment_this_month", label: "No payment this month" },
  { key: "high_risk", label: "High risk" },
]

const priorityMeta: Record<
  CollectionPriority,
  { label: string; className: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  critical: {
    label: "Critical",
    className: "border-red-200 bg-red-50 text-red-700",
    tone: "danger",
  },
  high: {
    label: "High",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    tone: "warning",
  },
  medium: {
    label: "Medium",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    tone: "warning",
  },
  low: {
    label: "Low",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    tone: "info",
  },
  settled: {
    label: "Settled",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    tone: "success",
  },
}

const EMPTY_FINANCE_SUMMARIES: FinanceDashboard["summaries"] = {
  totalExpected: 0,
  totalPending: 0,
  totalOverdue: 0,
  totalAdvance: 0,
  residentsWithPending: 0,
  highRiskResidents: 0,
}

const EMPTY_DUE_WINDOWS: FinanceDashboard["dueWindows"] = {
  today: 0,
  todayCount: 0,
  week: 0,
  weekCount: 0,
  month: 0,
  monthCount: 0,
}

const EMPTY_AGING_BUCKETS: FinanceDashboard["agingBuckets"] = [
  { key: "current", label: "Current", count: 0, amount: 0 },
  { key: "1-7", label: "1-7 Days", count: 0, amount: 0 },
  { key: "8-15", label: "8-15 Days", count: 0, amount: 0 },
  { key: "16-30", label: "16-30 Days", count: 0, amount: 0 },
  { key: "30+", label: "30+ Days", count: 0, amount: 0 },
]

const EMPTY_ATTENTION: FinanceDashboard["attention"] = {
  critical: [],
  high: [],
  medium: [],
  low: [],
}

export function AdminFinanceClient({
  initialResidentId,
}: {
  initialResidentId?: string
}) {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<SmartFilter>("all")
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(
    initialResidentId ?? null
  )
  const [cashCollectionOpen, setCashCollectionOpen] = useState(false)
  const runAutomation = useRunFinanceAutomation()
  const today = todayDateOnly()

  const dashboard = useFinanceDashboard(
    organizationId
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const finance = dashboard.data
  const financeRows = useMemo(() => finance?.residentFinance ?? [], [finance])
  const selectedResident =
    financeRows.find((row) => row.resident.id === selectedResidentId) ?? null
  const filteredRows = useMemo(
    () => filterFinanceRows(financeRows, search, filter, today),
    [filter, financeRows, search, today]
  )
  const summaries = finance?.summaries ?? EMPTY_FINANCE_SUMMARIES
  const agingBuckets = finance?.agingBuckets ?? EMPTY_AGING_BUCKETS
  const attention = finance?.attention ?? EMPTY_ATTENTION
  const timeline = finance?.timeline ?? []
  const recentPayments = finance?.recentPayments ?? []
  const owner = finance?.owner
  const dueWindows = finance?.dueWindows ?? EMPTY_DUE_WINDOWS
  const expectedCollection = finance?.kpis.expectedCollection ?? 0
  const collectedAmount = finance?.kpis.collectedAmount ?? 0
  const pendingAmount = finance?.kpis.pendingAmount ?? 0
  const collectionRate = finance?.kpis.collectionRate ?? 0
  const collectionEfficiency = finance?.kpis.collectionEfficiency ?? 0
  const loading = dashboard.isLoading

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  async function generateCurrentMonthDues() {
    if (!organizationId) {
      return
    }

    try {
      const result = await runAutomation.mutateAsync({
        organizationId,
        hostelId,
        name: "monthly_fee_generation",
        dryRun: false,
        payload: {
          periodMonth: monthStartDateOnly(),
        },
      })

      await dashboard.refetch()
      toast.success(result.result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate monthly dues.")
    }
  }

  async function queuePaymentReminders() {
    if (!organizationId) {
      return
    }

    try {
      const result = await runAutomation.mutateAsync({
        organizationId,
        hostelId,
        name: "payment_reminder",
        dryRun: false,
        payload: {
          dueBeforeDate: today,
          limit: 200,
        },
      })

      toast.success(
        `${result.result.message} Processed ${result.result.processed}, skipped ${result.result.skipped}.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue payment reminders.")
    }
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Finance"
        description="Money, risk, collections, and owner-level revenue intelligence for hostel operations."
        badge="Collections Command"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setCashCollectionOpen(true)}
              className="shadow-sm"
            >
              <Banknote className="size-4" aria-hidden="true" />
              Record Cash Collection
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={runAutomation.isPending}
              onClick={() => void generateCurrentMonthDues()}
            >
              <WalletCards className="size-4" aria-hidden="true" />
              Generate dues
            </Button>
            <Button
              type="button"
              disabled={runAutomation.isPending}
              onClick={() => void queuePaymentReminders()}
            >
              <Bell className="size-4" aria-hidden="true" />
              Bulk reminders
            </Button>
          </div>
        }
      />

      <nav className="sticky top-16 z-10 -mx-4 overflow-x-auto border-y bg-background/85 px-4 py-3 backdrop-blur md:top-0">
        <div className="flex min-w-max gap-2">
          {[
            ["Overview", "#overview"],
            ["Pending Dues", "#attention"],
            ["Collections", "#collections"],
            ["Resident Finance", "#intelligence"],
            ["Payments", "/admin/payments"],
            ["Invoices", "#timeline"],
            ["Timeline", "#timeline"],
            ["Reports", "/admin/reports"],
          ].map(([label, href]) =>
            href.startsWith("#") ? (
              <a
                key={label}
                href={href}
                className="rounded-lg border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                href={href as Route}
                className="rounded-lg border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                {label}
              </Link>
            )
          )}
        </div>
      </nav>

      {dashboard.isError ? (
        <APIErrorState
          title="Finance data could not be loaded"
          message="Retry the finance dashboard after checking the finance aggregation API."
          onRetry={() => {
            void dashboard.refetch()
          }}
        />
      ) : null}

      {loading ? (
        <LoadingState variant="dashboard" />
      ) : (
        <>
          <section id="overview" className="grid gap-4">
            <div className="grid auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-4 xl:overflow-visible">
              <FinanceKpiCard
                icon={IndianRupee}
                label="Expected Collection"
                value={formatCurrency(expectedCollection)}
                detail="Generated monthly dues"
                tone="info"
              />
              <FinanceKpiCard
                icon={CheckCircle2}
                label="Collected Amount"
                value={formatCurrency(collectedAmount)}
                detail="Verified revenue"
                tone="success"
              />
              <FinanceKpiCard
                icon={Clock3}
                label="Pending Amount"
                value={formatCurrency(pendingAmount)}
                detail={`${summaries.residentsWithPending} residents pending`}
                tone="warning"
              />
              <FinanceKpiCard
                icon={TrendingUp}
                label="Collection Rate"
                value={`${collectionRate}%`}
                detail="Collected vs expected"
                tone={collectionRate >= 85 ? "success" : collectionRate >= 60 ? "warning" : "danger"}
              />
              <FinanceKpiCard
                icon={Users}
                label="Active Residents"
                value={finance?.kpis.activeResidents ?? owner?.summary.activeResidents ?? 0}
                detail="Operationally active"
                tone="info"
              />
              <FinanceKpiCard
                icon={ShieldAlert}
                label="Residents With Pending Dues"
                value={owner?.summary.unpaidResidents ?? summaries.residentsWithPending}
                detail="Needs collection action"
                tone="warning"
              />
              <FinanceKpiCard
                icon={AlertTriangle}
                label="Overdue Amount"
                value={formatCurrency(summaries.totalOverdue)}
                detail="Past due date"
                tone="danger"
              />
              <FinanceKpiCard
                icon={WalletCards}
                label="Advance Balance"
                value={formatCurrency(summaries.totalAdvance)}
                detail="Unapplied credit"
                tone="success"
              />
              <FinanceKpiCard
                icon={CalendarClock}
                label="Due Today"
                value={formatCurrency(dueWindows.today)}
                detail={`${dueWindows.todayCount} due records`}
                tone="warning"
              />
              <FinanceKpiCard
                icon={CalendarClock}
                label="Due This Week"
                value={formatCurrency(dueWindows.week)}
                detail={`${dueWindows.weekCount} due records`}
                tone="info"
              />
              <FinanceKpiCard
                icon={CalendarClock}
                label="Due This Month"
                value={formatCurrency(dueWindows.month)}
                detail={`${dueWindows.monthCount} due records`}
                tone="info"
              />
              <FinanceKpiCard
                icon={Sparkles}
                label="Collection Efficiency"
                value={`${Math.round(collectionEfficiency)}%`}
                detail="Payment behavior quality"
                tone={collectionEfficiency >= 80 ? "success" : "warning"}
              />
            </div>
          </section>

          <section id="attention" className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border bg-card/90 p-4 shadow-soft">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Attention Center
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">Collection priority queue</h2>
                </div>
                <Badge variant="secondary">
                  {financeRows.filter((row) => row.currentDue > 0).length} open accounts
                </Badge>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <AttentionGroup
                  title="Critical"
                  description="Overdue more than 30 days"
                  rows={attention.critical}
                  onOpen={(row) => setSelectedResidentId(row.resident.id)}
                />
                <AttentionGroup
                  title="High"
                  description="Overdue 15-30 days"
                  rows={attention.high}
                  onOpen={(row) => setSelectedResidentId(row.resident.id)}
                />
                <AttentionGroup
                  title="Medium"
                  description="Overdue 7-15 days"
                  rows={attention.medium}
                  onOpen={(row) => setSelectedResidentId(row.resident.id)}
                />
                <AttentionGroup
                  title="Low"
                  description="Upcoming or newly due"
                  rows={attention.low}
                  onOpen={(row) => setSelectedResidentId(row.resident.id)}
                />
              </div>
            </div>

            <div id="collections" className="grid gap-4">
              <ForecastPanel owner={owner} summaries={summaries} />
              <AgingPanel buckets={agingBuckets} />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <CollectionsAnalytics trends={owner?.trends ?? []} />
            <RecentPaymentPanel rows={recentPayments} />
          </section>

          <section id="intelligence" className="rounded-xl border bg-card/90 shadow-soft">
            <div className="grid gap-3 border-b p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Resident Finance Intelligence
                </p>
                <h2 className="mt-1 text-xl font-semibold">Payment behavior, risk, and priority</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative">
                  <span className="sr-only">Search resident finance</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full pl-9 sm:w-72"
                    placeholder="Search name, phone, admission, invoice, receipt, transaction"
                  />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto border-b p-3">
              <div className="flex min-w-max gap-2">
                {smartFilters.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition",
                      filter === item.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState
                title="No finance records match"
                message="Adjust search or smart filters to review resident finance intelligence."
              />
            ) : (
              <div className="grid gap-3 p-4">
                <div className="hidden overflow-hidden rounded-xl border lg:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Resident</th>
                        <th className="px-4 py-3">Monthly Fee</th>
                        <th className="px-4 py-3">Current Due</th>
                        <th className="px-4 py-3">Advance</th>
                        <th className="px-4 py-3">Last Payment</th>
                        <th className="px-4 py-3">Avg Delay</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRows.map((row) => (
                        <ResidentFinanceTableRow
                          key={row.resident.id}
                          row={row}
                          onOpen={() => setSelectedResidentId(row.resident.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 lg:hidden">
                  {filteredRows.map((row) => (
                    <ResidentFinanceMobileCard
                      key={row.resident.id}
                      row={row}
                      onOpen={() => setSelectedResidentId(row.resident.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section id="timeline" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <FinanceTimelinePanel events={timeline} />
            <OwnerInsightPanel owner={owner} rows={financeRows} />
          </section>
        </>
      )}

      <FinanceResidentDrawer
        row={selectedResident}
        open={Boolean(selectedResident)}
        onOpenChange={(open) => !open && setSelectedResidentId(null)}
      />
      <CashCollectionDialog
        open={cashCollectionOpen}
        onOpenChange={setCashCollectionOpen}
        organizationId={organizationId}
        hostelId={hostelId}
        rows={financeRows}
        onRecorded={() => void dashboard.refetch()}
      />
    </ResponsiveContainer>
  )
}

type CollectionMethod = "cash" | "upi" | "bank_transfer"

function CashCollectionDialog({
  open,
  onOpenChange,
  organizationId,
  hostelId,
  rows,
  onRecorded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  hostelId?: string
  rows: ResidentFinanceSummary[]
  onRecorded: () => void
}) {
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<CollectionMethod>("cash")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const recordPayment = useRecordInPersonPayment()
  const matches = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    const candidates = normalized
      ? rows.filter((row) => row.searchIndex.includes(normalized))
      : rows.filter((row) => row.currentDue > 0)

    return candidates.slice(0, 8)
  }, [rows, search])
  const selected =
    rows.find((row) => row.resident.id === selectedId) ?? matches[0] ?? null
  const paymentAmount = Number(amount)
  const payableDue = selected?.primaryDueBalance ?? 0
  const isAdvance = Boolean(selected && !selected.primaryDueRecordId)
  const isPartial = Boolean(
    selected?.primaryDueRecordId && paymentAmount > 0 && paymentAmount < payableDue
  )
  const isOverDueAmount = Boolean(
    selected?.primaryDueRecordId && paymentAmount > payableDue
  )

  async function submit() {
    if (!selected || !hostelId) {
      toast.error("Choose a resident before recording collection.")
      return
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      toast.error("Enter a valid collected amount.")
      return
    }

    if (isOverDueAmount) {
      toast.error("Amount is higher than the selected due. Record the extra amount as advance separately.")
      return
    }

    try {
      await recordPayment.mutateAsync({
        organizationId,
        hostelId,
        residentId: selected.resident.id,
        ...(selected.primaryDueRecordId
          ? { monthlyFeeRecordId: selected.primaryDueRecordId }
          : {}),
        amount: paymentAmount,
        method,
        manualReference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        isAdvance,
        isPartial,
        idempotencyKey: `collection-${selected.resident.id}-${Date.now()}`,
      })
      toast.success("Collection recorded, verified, invoiced, and added to timeline.")
      setSearch("")
      setSelectedId(null)
      setAmount("")
      setReference("")
      setNotes("")
      onRecorded()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record collection.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Record Cash Collection</DialogTitle>
          <DialogDescription>
            Search, collect, verify, invoice, and receipt without opening the resident profile.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="collection-resident-search">Resident search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="collection-resident-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSelectedId(null)
                }}
                className="pl-9"
                placeholder="Name, phone, admission ID, invoice, receipt, transaction"
              />
            </div>
          </div>

          <div className="grid gap-2">
            {matches.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No residents match this search.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {matches.map((row) => (
                  <button
                    key={row.resident.id}
                    type="button"
                    onClick={() => setSelectedId(row.resident.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition hover:border-primary/40",
                      selected?.resident.id === row.resident.id
                        ? "border-primary bg-primary/5"
                        : "bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ResidentName row={row} compact />
                      <StatusBadge status={row.resident.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <MiniMetric label="Current due" value={formatCurrency(row.currentDue)} />
                      <MiniMetric
                        label="Last payment"
                        value={row.lastPaymentDate ? formatDate(row.lastPaymentDate) : "None"}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected ? (
            <section className="rounded-xl border bg-muted/35 p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <MiniMetric label="Resident" value={selected.resident.full_name} />
                <MiniMetric label="Current Due" value={formatCurrency(selected.currentDue)} />
                <MiniMetric
                  label="Last Payment"
                  value={
                    selected.lastPaymentDate
                      ? `${formatCurrency(selected.lastPaymentAmount)} · ${formatDate(selected.lastPaymentDate)}`
                      : "None"
                  }
                />
                <MiniMetric label="Status" value={humanizeEnum(selected.resident.status)} />
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="collection-amount">Amount received</Label>
              <Input
                id="collection-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="3500"
              />
              {isOverDueAmount ? (
                <p className="text-sm text-destructive">
                  This exceeds the selected due of {formatCurrency(payableDue)}.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collection-method">Payment method</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as CollectionMethod)}>
                <SelectTrigger id="collection-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collection-reference">Reference</Label>
              <Input
                id="collection-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={method === "cash" ? "Receipt or staff note" : "UTR / transaction ID"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collection-notes">Notes</Label>
              <Input
                id="collection-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Counter collection, parent paid, etc."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={recordPayment.isPending || !selected || !paymentAmount || isOverDueAmount}
            onClick={() => void submit()}
          >
            {recordPayment.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ReceiptText className="size-4" aria-hidden="true" />
            )}
            Record Collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FinanceKpiCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  detail: string
  tone: "success" | "warning" | "danger" | "info"
}) {
  const toneClassName = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    danger: "bg-red-50 text-red-700 ring-red-100",
    info: "bg-sky-50 text-sky-700 ring-sky-100",
  }[tone]

  return (
    <a
      href="#intelligence"
      className="group rounded-xl border bg-card/90 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg ring-1", toneClassName)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{detail}</p>
        <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
      </div>
    </a>
  )
}

function AttentionGroup({
  title,
  description,
  rows,
  onOpen,
}: {
  title: string
  description: string
  rows: ResidentFinanceSummary[]
  onOpen: (row: ResidentFinanceSummary) => void
}) {
  return (
    <section className="rounded-xl border bg-background/65 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <div className="mt-3 grid gap-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No residents in this queue.
          </p>
        ) : (
          rows.slice(0, 4).map((row) => (
            <ResidentAttentionCard key={row.resident.id} row={row} onOpen={() => onOpen(row)} />
          ))
        )}
      </div>
    </section>
  )
}

function ResidentAttentionCard({
  row,
  onOpen,
}: {
  row: ResidentFinanceSummary
  onOpen: () => void
}) {
  const whatsappUrl = buildWhatsappUrl({
    phone: row.resident.phone,
    message: reminderMessage(row),
  })

  return (
    <article className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.resident.full_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.resident.phone ?? "No phone"}</p>
        </div>
        <PriorityBadge priority={row.priority} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <MiniMetric label="Monthly fee" value={formatCurrency(row.monthlyFee)} />
        <MiniMetric label="Current due" value={formatCurrency(row.currentDue)} />
        <MiniMetric label="Days overdue" value={row.daysOverdue} />
        <MiniMetric label="Risk score" value={row.riskScore} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Last payment: {row.lastPaymentDate ? formatDate(row.lastPaymentDate) : "No verified payment"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" disabled={!row.resident.phone}>
          <a href={row.resident.phone ? `tel:${row.resident.phone}` : undefined}>
            <PhoneCall className="size-3.5" aria-hidden="true" />
            Call
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" disabled={!whatsappUrl}>
          <a href={whatsappUrl ?? undefined} target="_blank" rel="noreferrer">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            WhatsApp
          </a>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => copyReminder(row)}
        >
          <Bell className="size-3.5" aria-hidden="true" />
          Reminder
        </Button>
        <Button type="button" size="sm" onClick={onOpen}>
          View Finance
        </Button>
      </div>
    </article>
  )
}

function ForecastPanel({
  owner,
  summaries,
}: {
  owner?: FinanceOwnerAnalytics
  summaries: FinanceDashboard["summaries"]
}) {
  const forecast = owner?.forecasts.revenue
  const expectedSevenDays = Math.round((forecast?.expectedCollectedRevenue ?? summaries.totalExpected) / 4)
  const expectedThirtyDays = forecast?.nextMonthExpectedBilling ?? summaries.totalExpected
  const riskAmount = forecast?.riskAdjustedPendingDues ?? summaries.totalOverdue

  return (
    <section className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Owner Forecast
          </p>
          <h2 className="mt-1 text-xl font-semibold">Revenue outlook</h2>
        </div>
        <LineChart className="size-5 text-primary" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniMetric label="Next 7 days" value={formatCurrency(expectedSevenDays)} />
        <MiniMetric label="Next 30 days" value={formatCurrency(expectedThirtyDays)} />
        <MiniMetric label="Pending risk" value={formatCurrency(riskAmount)} />
        <MiniMetric label="High-risk residents" value={summaries.highRiskResidents} />
      </div>
    </section>
  )
}

function AgingPanel({ buckets }: { buckets: FinanceDashboard["agingBuckets"] }) {
  const maxAmount = Math.max(...buckets.map((bucket) => bucket.amount), 1)

  return (
    <section className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Payment Aging
          </p>
          <h2 className="mt-1 text-xl font-semibold">Open dues by age</h2>
        </div>
        <Clock3 className="size-5 text-primary" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{bucket.label}</span>
              <span className="text-muted-foreground">
                {bucket.count} · {formatCurrency(bucket.amount)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, (bucket.amount / maxAmount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CollectionsAnalytics({
  trends,
}: {
  trends: Array<{
    month: string
    revenue: number
    billed: number
    dues: number
    paymentConversion: number
  }>
}) {
  const visibleTrends = trends.slice(-6)
  const maxValue = Math.max(
    ...visibleTrends.flatMap((trend) => [trend.revenue, trend.billed]),
    1
  )

  return (
    <section className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Collections Analytics
          </p>
          <h2 className="mt-1 text-xl font-semibold">Expected vs actual collections</h2>
        </div>
        <TrendingUp className="size-5 text-primary" aria-hidden="true" />
      </div>
      {visibleTrends.length === 0 ? (
        <EmptyState title="No collection trends yet" message="Verified payments will build finance trends." />
      ) : (
        <div className="mt-5 grid gap-4">
          {visibleTrends.map((trend) => (
            <div key={trend.month} className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{trend.month}</span>
                <span className="text-muted-foreground">
                  {Math.round(trend.paymentConversion)}% rate
                </span>
              </div>
              <div className="grid gap-1">
                <Bar label="Expected" value={trend.billed} max={maxValue} className="bg-sky-500" />
                <Bar label="Actual" value={trend.revenue} max={maxValue} className="bg-emerald-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function RecentPaymentPanel({
  rows,
}: {
  rows: Array<{
    id: string
    resident_id: string
    amount: number
    status: string
    method: string
    created_at: string
    verified_at: string | null
  }>
}) {
  return (
    <section className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Payment Operations
          </p>
          <h2 className="mt-1 text-xl font-semibold">Recent payment activity</h2>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={"/admin/payments" as Route}>
            <CreditCard className="size-4" aria-hidden="true" />
            Payments
          </Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.length === 0 ? (
          <EmptyState title="No payments yet" message="Payment activity appears after residents pay." />
        ) : (
          rows.slice(0, 6).map((payment) => (
            <div
              key={payment.id}
              className="grid gap-2 rounded-xl border bg-background/65 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{payment.resident_id}</p>
                <p className="text-xs text-muted-foreground">
                  {humanizeEnum(payment.method)} · {formatDateTime(financePaymentDate(payment))}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                <StatusBadge status={payment.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function ResidentFinanceTableRow({
  row,
  onOpen,
}: {
  row: ResidentFinanceSummary
  onOpen: () => void
}) {
  return (
    <tr className="bg-card transition hover:bg-muted/35">
      <td className="px-4 py-3">
        <ResidentName row={row} />
      </td>
      <td className="px-4 py-3">{formatCurrency(row.monthlyFee)}</td>
      <td className="px-4 py-3">{formatCurrency(row.currentDue)}</td>
      <td className="px-4 py-3">{formatCurrency(row.advanceBalance)}</td>
      <td className="px-4 py-3">
        {row.lastPaymentDate ? (
          <div>
            <p>{formatDate(row.lastPaymentDate)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(row.lastPaymentAmount)}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">No payment</span>
        )}
      </td>
      <td className="px-4 py-3">{row.averageDelayDays}d</td>
      <td className="px-4 py-3">
        <ScorePill value={row.collectionScore} mode="collection" />
      </td>
      <td className="px-4 py-3">
        <ScorePill value={row.riskScore} mode="risk" />
      </td>
      <td className="px-4 py-3">
        <PriorityBadge priority={row.priority} />
      </td>
      <td className="px-4 py-3 text-right">
        <Button type="button" size="sm" onClick={onOpen}>
          Open
        </Button>
      </td>
    </tr>
  )
}

function ResidentFinanceMobileCard({
  row,
  onOpen,
}: {
  row: ResidentFinanceSummary
  onOpen: () => void
}) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <ResidentName row={row} />
        <PriorityBadge priority={row.priority} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniMetric label="Monthly fee" value={formatCurrency(row.monthlyFee)} />
        <MiniMetric label="Current due" value={formatCurrency(row.currentDue)} />
        <MiniMetric label="Advance" value={formatCurrency(row.advanceBalance)} />
        <MiniMetric label="Average delay" value={`${row.averageDelayDays}d`} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <ScorePill value={row.collectionScore} mode="collection" />
          <ScorePill value={row.riskScore} mode="risk" />
        </div>
        <Button type="button" size="sm" onClick={onOpen}>
          View
        </Button>
      </div>
    </article>
  )
}

function FinanceTimelinePanel({ events }: { events: FinanceTimelineEvent[] }) {
  const [kind, setKind] = useState<FinanceTimelineEvent["kind"] | "all">("all")
  const filteredEvents = useMemo(
    () => (kind === "all" ? events : events.filter((event) => event.kind === kind)),
    [events, kind]
  )
  const grouped = useMemo(() => groupTimelineEvents(filteredEvents), [filteredEvents])

  return (
    <section className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Finance Timeline
          </p>
          <h2 className="mt-1 text-xl font-semibold">Banking-style activity stream</h2>
        </div>
        <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter finance timeline">
            <Filter className="size-4" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            <SelectItem value="payment_received">Payments</SelectItem>
            <SelectItem value="cash_collected">Cash collected</SelectItem>
            <SelectItem value="invoice_generated">Invoices</SelectItem>
            <SelectItem value="receipt_generated">Receipts</SelectItem>
            <SelectItem value="followup_scheduled">Follow-ups</SelectItem>
            <SelectItem value="due_generated">Dues</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 grid gap-5">
        {filteredEvents.length === 0 ? (
          <EmptyState title="No finance events yet" message="Fees, invoices, and payments create the timeline." />
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="grid gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
              <div className="grid gap-2">
                {group.events.map((event) => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function OwnerInsightPanel({
  owner,
  rows,
}: {
  owner?: FinanceOwnerAnalytics
  rows: ResidentFinanceSummary[]
}) {
  const topPayers = rows
    .filter((row) => row.collectionScore >= 80)
    .sort((a, b) => b.collectionScore - a.collectionScore)
    .slice(0, 4)

  return (
    <section className="rounded-xl border bg-card/90 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Owner Intelligence
          </p>
          <h2 className="mt-1 text-xl font-semibold">Daily collection command</h2>
        </div>
        <Sparkles className="size-5 text-primary" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricGroup
          title="Collections Today"
          icon={Banknote}
          rows={[
            ["Cash", formatCurrency(owner?.collectionToday.cash ?? 0)],
            ["UPI", formatCurrency(owner?.collectionToday.upi ?? 0)],
            ["Bank", formatCurrency(owner?.collectionToday.bank ?? 0)],
            ["Total", formatCurrency(owner?.collectionToday.total ?? 0)],
          ]}
        />
        <MetricGroup
          title="Due Today"
          icon={CalendarClock}
          rows={[
            ["Residents Due", owner?.summary.unpaidResidents ?? 0],
            ["Expected Collection", formatCurrency(owner?.summary.billed ?? 0)],
          ]}
        />
        <MetricGroup
          title="Upcoming Dues"
          icon={Clock3}
          rows={[
            ["Next 7 Days", formatCurrency(owner?.upcomingDues.next7Days ?? 0)],
            ["Next 15 Days", formatCurrency(owner?.upcomingDues.next15Days ?? 0)],
            ["Next 30 Days", formatCurrency(owner?.upcomingDues.next30Days ?? 0)],
          ]}
        />
        <MetricGroup
          title="High Risk Residents"
          icon={ShieldAlert}
          rows={[
            ["30+ overdue", owner?.highRisk.overdue30Plus ?? 0],
            ["60+ overdue", owner?.highRisk.overdue60Plus ?? 0],
            ["90+ overdue", owner?.highRisk.overdue90Plus ?? 0],
          ]}
        />
        <MetricGroup
          title="Collection Efficiency"
          icon={TrendingUp}
          rows={[
            ["Expected", formatCurrency(owner?.summary.billed ?? 0)],
            ["Collected", formatCurrency(owner?.summary.revenue ?? 0)],
            ["Pending", formatCurrency(owner?.summary.pendingDues ?? 0)],
            ["Recovery", `${Math.round(owner?.summary.paymentConversion ?? 0)}%`],
          ]}
        />
        <RankedList title="Best payers" rows={topPayers} metric="score" />
      </div>
      {owner?.insights.length ? (
        <div className="mt-4 grid gap-2">
          {owner.insights.slice(0, 3).map((insight) => (
            <div key={insight.title} className="rounded-xl border bg-background/65 p-3">
              <p className="font-medium">{insight.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function MetricGroup({
  title,
  icon: Icon,
  rows,
}: {
  title: string
  icon: LucideIcon
  rows: Array<[string, string | number]>
}) {
  return (
    <div className="rounded-xl border bg-background/65 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <Icon className="size-4 text-primary" aria-hidden="true" />
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinanceResidentDrawer({
  row,
  open,
  onOpenChange,
}: {
  row: ResidentFinanceSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const ledger = useResidentPaymentLedger(
    open && row
      ? {
          organizationId: row.resident.organization_id,
          residentId: row.resident.id,
        }
      : undefined
  )
  const advanceLedger = useAdvanceLedger(
    open && row
      ? {
          organizationId: row.resident.organization_id,
          hostelId: row.resident.hostel_id ?? undefined,
          residentId: row.resident.id,
        }
      : undefined
  )
  const detailLedger = ledger.data
  const detailTimeline = detailLedger ? buildFinanceTimeline([detailLedger], 10) : []
  const [followupNote, setFollowupNote] = useState("")
  const [nextFollowupAt, setNextFollowupAt] = useState("")
  const [correctionType, setCorrectionType] = useState<
    "monthly_fee" | "advance_balance" | null
  >(null)
  const [correctionValue, setCorrectionValue] = useState("")
  const [correctionReason, setCorrectionReason] = useState("")
  const [feeAction, setFeeAction] = useState<"receive" | "advance" | null>(null)
  const [feeAmount, setFeeAmount] = useState("")
  const [feeMonth, setFeeMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [feePaymentDate, setFeePaymentDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [feePaymentMode, setFeePaymentMode] = useState<"cash" | "upi" | "bank_transfer">("cash")
  const [feeNotes, setFeeNotes] = useState("")
  const followups = useCollectionFollowups(
    open && row
      ? {
          organizationId: row.resident.organization_id,
          hostelId: row.resident.hostel_id ?? undefined,
          residentId: row.resident.id,
          limit: 5,
        }
      : undefined
  )
  const correctionAudit = useAuditLogs(
    "activity",
    open && row
      ? {
          organizationId: row.resident.organization_id,
          hostelId: row.resident.hostel_id ?? undefined,
          recordId: row.resident.id,
          tableName: "residents",
          page: 1,
          pageSize: 50,
        }
      : undefined
  )
  const createFollowup = useCreateCollectionFollowup()
  const completeFollowup = useCompleteCollectionFollowup()
  const applyCorrection = useApplyFinancialCorrection()
  const generateMonthlyFee = useGenerateMonthlyFee()
  const recordMonthlyFee = useRecordInPersonPayment()
  const allocateAdvance = useAllocateAdvance()
  const openFollowup = followups.data?.find((followup) => followup.status === "open")
  const followupBusy = createFollowup.isPending || completeFollowup.isPending
  const monthlyFee = row?.resident.monthly_fee_amount ?? row?.monthlyFee ?? 0
  const currentAdvanceBalance =
    advanceLedger.data?.balance.remainingAdvanceBalance ?? row?.advanceBalance ?? 0
  const correctionLogs = (correctionAudit.data?.data ?? []).filter((log) =>
    row ? isFinancialCorrectionForResident(log, row.resident.id) : false
  )

  function openCorrectionDialog(type: "monthly_fee" | "advance_balance") {
    const currentValue = type === "monthly_fee" ? monthlyFee : currentAdvanceBalance

    setCorrectionType(type)
    setCorrectionValue(String(currentValue))
    setCorrectionReason("")
  }

  function openFeeAction(type: "receive" | "advance") {
    setFeeAction(type)
    setFeeAmount(type === "advance" ? String(currentAdvanceBalance) : String(monthlyFee))
    setFeeMonth(new Date().toISOString().slice(0, 7))
    setFeePaymentDate(new Date().toISOString().slice(0, 10))
    setFeePaymentMode("cash")
    setFeeNotes("")
  }

  async function submitFeeAction() {
    if (!row || !feeAction) {
      return
    }

    const amount = Number(feeAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter an amount greater than zero.")
      return
    }

    if (!/^\d{4}-\d{2}$/.test(feeMonth)) {
      toast.error("Choose a valid fee month.")
      return
    }

    if (feeAction === "advance" && amount > currentAdvanceBalance) {
      toast.error("Adjustment amount exceeds available advance.")
      return
    }

    const periodMonth = `${feeMonth}-01`

    try {
      const feeRecord = await generateMonthlyFee.mutateAsync({
        organizationId: row.resident.organization_id,
        hostelId: row.resident.hostel_id,
        residentId: row.resident.id,
        periodMonth,
        dueDate: billingDateForMonth(feeMonth, row.resident.joined_on),
        discountAmount: 0,
        penaltyAmount: 0,
        adjustmentAmount: 0,
        advanceAdjustmentAmount: 0,
        notes: feeNotes || undefined,
        skipAutomaticAdvanceAllocation: true,
      })

      if (amount > feeRecord.balance_amount) {
        toast.error(
          `Amount exceeds the selected month outstanding of ${formatCurrency(feeRecord.balance_amount)}.`
        )
        return
      }

      if (feeAction === "receive") {
        await recordMonthlyFee.mutateAsync({
          organizationId: row.resident.organization_id,
          hostelId: row.resident.hostel_id,
          residentId: row.resident.id,
          monthlyFeeRecordId: feeRecord.id,
          amount,
          paymentDate: feePaymentDate,
          method: feePaymentMode,
          notes: feeNotes || undefined,
          isAdvance: false,
          isPartial: amount < feeRecord.balance_amount,
          idempotencyKey: `monthly-fee-${row.resident.id}-${periodMonth}-${Date.now()}`,
        })
        toast.success("Monthly fee received and financial dashboards updated.")
      } else {
        await allocateAdvance.mutateAsync({
          organizationId: row.resident.organization_id,
          hostelId: row.resident.hostel_id,
          residentId: row.resident.id,
          monthlyFeeRecordId: feeRecord.id,
          amount,
          notes: feeNotes || undefined,
          limit: 1,
        })
        toast.success("Advance adjusted as fee without increasing revenue.")
      }

      await Promise.all([ledger.refetch(), advanceLedger.refetch()])
      setFeeAction(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update the resident fee."
      )
    }
  }

  async function submitCorrection() {
    if (!row || !correctionType) {
      return
    }

    const nextValue = Number(correctionValue)
    const reason = correctionReason.trim()

    if (!Number.isFinite(nextValue) || nextValue < 0) {
      toast.error("Enter a valid correction amount.")
      return
    }

    if (correctionType === "monthly_fee" && nextValue <= 0) {
      toast.error("Monthly fee must be greater than zero.")
      return
    }

    const currentValue =
      correctionType === "monthly_fee" ? monthlyFee : currentAdvanceBalance

    if (Math.round(nextValue * 100) === Math.round(currentValue * 100)) {
      toast.error("Enter a new value that differs from the current value.")
      return
    }

    if (reason.length < 6) {
      toast.error("Add a clear correction reason.")
      return
    }

    try {
      await applyCorrection.mutateAsync({
        organizationId: row.resident.organization_id,
        residentId: row.resident.id,
        changeType: correctionType,
        newValue: nextValue,
        reason,
      })
      await Promise.all([
        ledger.refetch(),
        advanceLedger.refetch(),
        correctionAudit.refetch(),
      ])
      toast.success("Financial correction applied and audit logged.")
      setCorrectionType(null)
      setCorrectionValue("")
      setCorrectionReason("")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to apply financial correction."
      )
    }
  }

  async function saveFollowup(status: "open" | "completed", scheduledAt?: string) {
    if (!row) {
      return
    }

    const note = followupNote.trim() || (status === "completed" ? "Follow-up completed." : "Collection follow-up scheduled.")

    await createFollowup.mutateAsync({
      organizationId: row.resident.organization_id,
      hostelId: row.resident.hostel_id ?? undefined,
      residentId: row.resident.id,
      note,
      status,
      ...(scheduledAt ? { nextFollowupAt: scheduledAt } : {}),
    })
    setFollowupNote("")
    toast.success(status === "completed" ? "Follow-up completed." : "Follow-up saved.")
  }

  async function completeCurrentFollowup() {
    if (!row) {
      return
    }

    if (!openFollowup) {
      await saveFollowup("completed")
      return
    }

    await completeFollowup.mutateAsync({
      organizationId: row.resident.organization_id,
      hostelId: row.resident.hostel_id ?? undefined,
      followupId: openFollowup.id,
      ...(followupNote.trim() ? { note: followupNote.trim() } : {}),
    })
    setFollowupNote("")
    toast.success("Follow-up completed.")
  }

  async function scheduleNextFollowup() {
    const scheduledAt = nextFollowupAt
      ? new Date(nextFollowupAt).toISOString()
      : tomorrowAtTen()

    await saveFollowup("open", scheduledAt)
    setNextFollowupAt("")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        {row ? (
          <>
            <SheetHeader className="border-b p-6 text-left">
              <div className="flex items-start gap-4">
                <ResidentAvatar name={row.resident.full_name} className="size-14" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl">{row.resident.full_name}</SheetTitle>
                  <SheetDescription className="mt-1">
                    {formatResidentSerial(row.resident)} · {row.resident.admission_number} ·{" "}
                    {row.resident.phone ?? "No phone"}
                  </SheetDescription>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={row.resident.status} />
                    <PriorityBadge priority={row.priority} />
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="grid gap-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <MiniMetric label="Monthly fee" value={formatCurrency(monthlyFee)} large />
                <MiniMetric label="Current due" value={formatCurrency(row.currentDue)} large />
                <MiniMetric label="Advance" value={formatCurrency(currentAdvanceBalance)} large />
                <MiniMetric
                  label="Outstanding"
                  value={formatCurrency(row.currentDue - currentAdvanceBalance)}
                  large
                />
                <MiniMetric
                  label="Next Payment Date"
                  value={
                    detailLedger?.billing.nextDueDate
                      ? formatDate(detailLedger.billing.nextDueDate)
                      : "Not scheduled"
                  }
                  large
                  className="sm:col-span-2"
                />
              </div>

              <section className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold">Fee Collection</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Receive a monthly fee or consume available advance for a selected month.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => openFeeAction("receive")}>
                      <Banknote className="size-4" aria-hidden="true" />
                      Receive Monthly Fee
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={currentAdvanceBalance <= 0}
                      onClick={() => openFeeAction("advance")}
                    >
                      <WalletCards className="size-4" aria-hidden="true" />
                      Adjust Advance as Fee
                    </Button>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold">Controlled Financial Corrections</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Adjust current resident fee or advance balance with reasoned audit history.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openCorrectionDialog("monthly_fee")}
                    >
                      <IndianRupee className="size-4" aria-hidden="true" />
                      Edit Monthly Fee
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openCorrectionDialog("advance_balance")}
                    >
                      <WalletCards className="size-4" aria-hidden="true" />
                      Edit Advance
                    </Button>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border bg-card p-4">
                <h3 className="font-semibold">Payment Behaviour</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniMetric label="Average delay" value={`${row.averageDelayDays} days`} />
                  <MiniMetric label="On-time" value={`${row.onTimeRate}%`} />
                  <MiniMetric label="Late payments" value={row.latePayments} />
                  <MiniMetric label="Collection score" value={row.collectionScore} />
                </div>
              </section>

              <Tabs defaultValue="timeline" className="grid gap-4">
                <TabsList className="w-full overflow-x-auto">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="fee-history">Fee History</TabsTrigger>
                  <TabsTrigger value="advance">Advance</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                  <TabsTrigger value="dues">Dues</TabsTrigger>
                  <TabsTrigger value="corrections">Corrections</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline">
                  <DrawerDetailState loading={ledger.isLoading} hasLedger={Boolean(detailLedger)}>
                    <div className="grid gap-3">
                      {detailTimeline.map((event) => (
                        <TimelineEvent key={event.id} event={event} />
                      ))}
                    </div>
                  </DrawerDetailState>
                </TabsContent>
                <TabsContent value="payments">
                  <DrawerDetailState loading={ledger.isLoading} hasLedger={Boolean(detailLedger)}>
                    <DrawerList
                      rows={(detailLedger?.payments ?? []).slice(0, 8).map((payment) => ({
                        id: payment.id,
                        title: formatCurrency(payment.amount),
                        detail: `${humanizeEnum(payment.method)} · ${formatDateTime(financePaymentDate(payment))}`,
                        status: payment.status,
                      }))}
                    />
                  </DrawerDetailState>
                </TabsContent>
                <TabsContent value="fee-history">
                  <DrawerDetailState loading={ledger.isLoading} hasLedger={Boolean(detailLedger)}>
                    <DrawerList
                      rows={(detailLedger?.feeHistory ?? []).slice(0, 12).map((entry) => ({
                        id: entry.id,
                        title: `${formatFeeMonth(entry.periodMonth)} Fee ${entry.status === "paid" ? "Cleared" : "Partially Cleared"}`,
                        detail: `${entry.source === "advance" ? "Paid from Advance" : `Paid by ${humanizeEnum(entry.method)}`} · ${formatDate(entry.paidAt)}`,
                        status: entry.status,
                      }))}
                    />
                  </DrawerDetailState>
                </TabsContent>
                <TabsContent value="advance">
                  <DrawerDetailState
                    loading={advanceLedger.isLoading}
                    hasLedger={Boolean(advanceLedger.data)}
                  >
                    <DrawerList
                      rows={[
                        ...(advanceLedger.data?.deposits ?? []).slice(0, 6).map((deposit) => ({
                          id: `deposit-${deposit.id}`,
                          title: `Deposit ${formatCurrency(deposit.amount)}`,
                          detail: `${humanizeEnum(deposit.payment_mode)} · ${formatDate(deposit.received_date)}`,
                          status: deposit.status,
                        })),
                        ...(advanceLedger.data?.allocations ?? []).slice(0, 6).map((allocation) => ({
                          id: `allocation-${allocation.id}`,
                          title: `Consumed ${formatCurrency(allocation.amount)}`,
                          detail: `${formatDate(allocation.period_month)} monthly fee allocation`,
                          status: allocation.allocation_status,
                        })),
                        ...(advanceLedger.data?.refunds ?? []).slice(0, 6).map((refund) => ({
                          id: `refund-${refund.id}`,
                          title: `Refund ${formatCurrency(refund.amount)}`,
                          detail: `${formatDate(refund.created_at)} · ${refund.reason}`,
                          status: refund.status,
                        })),
                      ].slice(0, 12)}
                    />
                  </DrawerDetailState>
                </TabsContent>
                <TabsContent value="invoices">
                  <DrawerDetailState loading={ledger.isLoading} hasLedger={Boolean(detailLedger)}>
                    <DrawerList
                      rows={(detailLedger?.invoices ?? []).slice(0, 8).map((invoice) => ({
                        id: invoice.id,
                        title: invoice.invoice_number,
                        detail: `${formatCurrency(invoice.total_amount)} · ${formatDate(invoice.issue_date)}`,
                        status: invoice.status,
                      }))}
                    />
                  </DrawerDetailState>
                </TabsContent>
                <TabsContent value="dues">
                  <DrawerDetailState loading={ledger.isLoading} hasLedger={Boolean(detailLedger)}>
                    <DrawerList
                      rows={(detailLedger?.feeRecords ?? []).slice(0, 8).map((fee) => ({
                        id: fee.id,
                        title: formatDate(fee.period_month),
                        detail: `${formatCurrency(fee.balance_amount)} left of ${formatCurrency(fee.total_amount)}`,
                        status: fee.status,
                      }))}
                    />
                  </DrawerDetailState>
                </TabsContent>
                <TabsContent value="corrections">
                  <DrawerDetailState
                    loading={correctionAudit.isLoading}
                    hasLedger={Boolean(correctionAudit.data)}
                  >
                    <CorrectionAuditList rows={correctionLogs} />
                  </DrawerDetailState>
                </TabsContent>
              </Tabs>

              <section className="rounded-xl border bg-card p-4">
                <h3 className="font-semibold">Collection Workflow</h3>
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="collection-note">Collection note</Label>
                    <Textarea
                      id="collection-note"
                      value={followupNote}
                      onChange={(event) => setFollowupNote(event.target.value)}
                      placeholder="Add call notes or next action..."
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <div className="grid gap-2">
                      <Label htmlFor="next-followup-at">Next follow-up</Label>
                      <Input
                        id="next-followup-at"
                        type="datetime-local"
                        value={nextFollowupAt}
                        onChange={(event) => setNextFollowupAt(event.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      className="self-end"
                      disabled={followupBusy}
                      onClick={() => void saveFollowup("open")}
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Add note
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" disabled={!row.resident.phone}>
                    <a href={row.resident.phone ? `tel:${row.resident.phone}` : undefined}>
                      <PhoneCall className="size-4" aria-hidden="true" />
                      Call
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href={
                        buildWhatsappUrl({
                          phone: row.resident.phone,
                          message: reminderMessage(row),
                        }) ?? undefined
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => copyReminder(row)}>
                    <Bell className="size-4" aria-hidden="true" />
                    Reminder
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={followupBusy}
                    onClick={() => void completeCurrentFollowup()}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Follow-up complete
                  </Button>
                  <Button
                    type="button"
                    disabled={followupBusy}
                    onClick={() => void scheduleNextFollowup()}
                  >
                    <CalendarClock className="size-4" aria-hidden="true" />
                    Schedule next
                  </Button>
                </div>
                {followups.data?.length ? (
                  <div className="mt-4 grid gap-2">
                    {followups.data.map((followup) => (
                      <div
                        key={followup.id}
                        className="flex items-start justify-between gap-3 rounded-lg border bg-background/70 p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{followup.note}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(followup.created_at)}
                            {followup.next_followup_at
                              ? ` · Next ${formatDateTime(followup.next_followup_at)}`
                              : ""}
                          </p>
                        </div>
                        <StatusBadge status={followup.status} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
      <Dialog open={Boolean(correctionType)} onOpenChange={(nextOpen) => !nextOpen && setCorrectionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {correctionType === "monthly_fee"
                ? "Edit Monthly Fee"
                : "Edit Advance Balance"}
            </DialogTitle>
            <DialogDescription>
              This creates an audit record with old value, new value, admin, timestamp, and reason.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-lg border bg-muted/35 p-3 text-sm">
              <span className="text-muted-foreground">Current value: </span>
              <span className="font-semibold">
                {formatCurrency(
                  correctionType === "monthly_fee" ? monthlyFee : currentAdvanceBalance
                )}
              </span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="financial-correction-value">New value</Label>
              <Input
                id="financial-correction-value"
                type="number"
                min={0}
                step={1}
                value={correctionValue}
                onChange={(event) => setCorrectionValue(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="financial-correction-reason">Reason</Label>
              <Textarea
                id="financial-correction-reason"
                rows={4}
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                placeholder="Example: Wrong fee entered during admission."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCorrectionType(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={applyCorrection.isPending}
              onClick={() => void submitCorrection()}
            >
              {applyCorrection.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              Apply Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(feeAction)} onOpenChange={(nextOpen) => !nextOpen && setFeeAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feeAction === "receive" ? "Receive Monthly Fee" : "Adjust Advance as Fee"}
            </DialogTitle>
            <DialogDescription>
              {feeAction === "receive"
                ? "Record a verified collection for the selected resident and month."
                : "Reduce available advance and apply it to the selected month. Revenue will not increase."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fee-action-amount">Amount</Label>
              <Input
                id="fee-action-amount"
                type="number"
                min={1}
                step="0.01"
                value={feeAmount}
                onChange={(event) => setFeeAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee-action-month">Month</Label>
              <Input
                id="fee-action-month"
                type="month"
                value={feeMonth}
                onChange={(event) => setFeeMonth(event.target.value)}
              />
            </div>
            {feeAction === "receive" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="fee-action-date">Payment date</Label>
                  <Input
                    id="fee-action-date"
                    type="date"
                    value={feePaymentDate}
                    onChange={(event) => setFeePaymentDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fee-action-mode">Payment mode</Label>
                  <Select
                    value={feePaymentMode}
                    onValueChange={(value) =>
                      setFeePaymentMode(value as "cash" | "upi" | "bank_transfer")
                    }
                  >
                    <SelectTrigger id="fee-action-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="fee-action-notes">Notes</Label>
              <Textarea
                id="fee-action-notes"
                rows={3}
                value={feeNotes}
                onChange={(event) => setFeeNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFeeAction(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                generateMonthlyFee.isPending ||
                recordMonthlyFee.isPending ||
                allocateAdvance.isPending
              }
              onClick={() => void submitFeeAction()}
            >
              {generateMonthlyFee.isPending ||
              recordMonthlyFee.isPending ||
              allocateAdvance.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function DrawerList({
  rows,
}: {
  rows: Array<{ id: string; title: string; detail: string; status: string }>
}) {
  if (rows.length === 0) {
    return <EmptyState title="No records" message="Records will appear as finance activity grows." />
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="text-sm text-muted-foreground">{row.detail}</p>
          </div>
          <StatusBadge status={row.status} />
        </div>
      ))}
    </div>
  )
}

function CorrectionAuditList({ rows }: { rows: Tables<"audit_logs">[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No corrections logged"
        message="Monthly fee and advance balance corrections will appear here."
      />
    )
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const oldValues = toPlainRecord(row.old_values)
        const newValues = toPlainRecord(row.new_values)
        const metadata = toPlainRecord(row.metadata)
        const oldAmount = Number(
          oldValues.monthly_fee_amount ?? oldValues.remaining_advance_balance ?? 0
        )
        const newAmount = Number(
          newValues.monthly_fee_amount ?? newValues.remaining_advance_balance ?? 0
        )
        const reason =
          typeof metadata.reason === "string" ? metadata.reason : "No reason saved"
        const adminName =
          typeof metadata.adminName === "string" ? metadata.adminName : "Hostel admin"

        return (
          <article key={row.id} className="rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {row.action === "finance_correction.monthly_fee_updated"
                    ? "Monthly fee correction"
                    : "Advance balance correction"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCurrency(oldAmount)} to {formatCurrency(newAmount)}
                </p>
              </div>
              <Badge variant="secondary">{formatDateTime(row.created_at)}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{reason}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Admin: {adminName}
            </p>
          </article>
        )
      })}
    </div>
  )
}

function isFinancialCorrectionForResident(
  log: Tables<"audit_logs">,
  residentId: string
) {
  if (!log.action.startsWith("finance_correction.")) {
    return false
  }

  if (log.record_id === residentId) {
    return true
  }

  return toPlainRecord(log.metadata).residentId === residentId
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function formatFeeMonth(periodMonth: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${periodMonth.slice(0, 7)}-01T00:00:00.000Z`))
}

function billingDateForMonth(month: string, joinedOn: string | null) {
  const requestedMonth = new Date(`${month}-01T00:00:00.000Z`)
  const requestedDay = joinedOn ? Number(joinedOn.slice(8, 10)) : 10
  const lastDay = new Date(
    Date.UTC(
      requestedMonth.getUTCFullYear(),
      requestedMonth.getUTCMonth() + 1,
      0
    )
  ).getUTCDate()
  const day = Math.min(Math.max(1, requestedDay || 10), lastDay)

  return `${month}-${String(day).padStart(2, "0")}`
}

function formatResidentSerial(resident: Tables<"residents">) {
  const metadata = toPlainRecord(resident.metadata)
  const serial = Number(metadata.resident_serial)

  return Number.isInteger(serial) && serial > 0
    ? `R${String(serial).padStart(4, "0")}`
    : "--"
}

function DrawerDetailState({
  loading,
  hasLedger,
  children,
}: {
  loading: boolean
  hasLedger: boolean
  children: ReactNode
}) {
  if (loading) {
    return <LoadingState variant="cards" />
  }

  if (!hasLedger) {
    return <EmptyState title="No ledger loaded" message="Open finance detail to load resident ledger history." />
  }

  return <>{children}</>
}

function RankedList({
  title,
  rows,
  metric,
}: {
  title: string
  rows: ResidentFinanceSummary[]
  metric: "due" | "score"
}) {
  return (
    <div className="rounded-xl border bg-background/65 p-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 grid gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No residents yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.resident.id} className="flex items-center justify-between gap-3">
              <ResidentName row={row} compact />
              <span className="text-sm font-semibold">
                {metric === "due" ? formatCurrency(row.currentDue) : row.collectionScore}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ResidentName({
  row,
  compact,
}: {
  row: ResidentFinanceSummary
  compact?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ResidentAvatar name={row.resident.full_name} className={compact ? "size-8" : "size-10"} />
      <div className="min-w-0">
        <p className="truncate font-medium">{row.resident.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.resident.admission_number} · {row.resident.phone ?? "No phone"}
        </p>
      </div>
    </div>
  )
}

function ResidentAvatar({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "R"

  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

function PriorityBadge({ priority }: { priority: CollectionPriority }) {
  const meta = priorityMeta[priority]

  return (
    <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", meta.className)}>
      {meta.label}
    </span>
  )
}

function ScorePill({
  value,
  mode,
}: {
  value: number
  mode: "collection" | "risk"
}) {
  const danger = mode === "risk" ? value >= 70 : value < 50
  const warning = mode === "risk" ? value >= 45 && value < 70 : value >= 50 && value < 75
  const className = danger
    ? "border-red-200 bg-red-50 text-red-700"
    : warning
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700"

  return (
    <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", className)}>
      {value}
    </span>
  )
}

function MiniMetric({
  label,
  value,
  large = false,
  className,
}: {
  label: string
  value: string | number
  large?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background/70 px-3 py-2",
        large && "flex min-h-32 min-w-0 flex-col justify-center px-5 py-6",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold",
          large
            ? "whitespace-normal [overflow-wrap:anywhere] text-2xl leading-snug"
            : "truncate"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Bar({
  label,
  value,
  max,
  className,
}: {
  label: string
  value: number
  max: number
  className: string
}) {
  return (
    <div className="grid grid-cols-[72px_1fr_96px] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", className)}
          style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
        />
      </div>
      <span className="text-right font-medium">{formatCurrency(value)}</span>
    </div>
  )
}

function TimelineEvent({ event }: { event: FinanceTimelineEvent }) {
  const meta = timelineEventMeta(event)
  const Icon = meta.icon

  return (
    <article className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border bg-background/65 p-3">
      <span className={cn("mt-0.5 flex size-9 items-center justify-center rounded-lg", meta.className)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{event.title}</p>
          <span className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt)}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {event.residentName} · {event.description}
        </p>
        {event.amount !== undefined ? (
          <p className="mt-1 text-sm font-semibold">{formatCurrency(event.amount)}</p>
        ) : null}
      </div>
    </article>
  )
}

function timelineEventMeta(event: FinanceTimelineEvent): {
  icon: LucideIcon
  className: string
} {
  const byKind: Partial<Record<FinanceTimelineEvent["kind"], { icon: LucideIcon; className: string }>> = {
    cash_collected: {
      icon: Banknote,
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    },
    payment_received: {
      icon: IndianRupee,
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    },
    invoice_generated: {
      icon: ReceiptText,
      className: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    },
    receipt_generated: {
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    },
    followup_scheduled: {
      icon: CalendarClock,
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    },
    followup_completed: {
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    },
    reminder_sent: {
      icon: Bell,
      className: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
    },
    due_generated: {
      icon: WalletCards,
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    },
    due_completed: {
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    },
  }

  return byKind[event.kind] ?? {
    icon: ReceiptText,
    className: "bg-muted text-muted-foreground",
  }
}

function groupTimelineEvents(events: FinanceTimelineEvent[]) {
  const groups = [
    { label: "Today", events: [] as FinanceTimelineEvent[] },
    { label: "Yesterday", events: [] as FinanceTimelineEvent[] },
    { label: "This Week", events: [] as FinanceTimelineEvent[] },
    { label: "Earlier", events: [] as FinanceTimelineEvent[] },
  ]
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const yesterdayDate = new Date(now)

  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)

  const yesterday = yesterdayDate.toISOString().slice(0, 10)
  const weekStartTime = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 6
  )

  for (const event of events) {
    const eventDate = event.occurredAt.slice(0, 10)
    const eventTime = new Date(event.occurredAt).getTime()

    if (eventDate === today) {
      groups[0].events.push(event)
    } else if (eventDate === yesterday) {
      groups[1].events.push(event)
    } else if (eventTime >= weekStartTime) {
      groups[2].events.push(event)
    } else {
      groups[3].events.push(event)
    }
  }

  return groups.filter((group) => group.events.length > 0)
}

function filterFinanceRows(
  rows: ResidentFinanceSummary[],
  search: string,
  filter: SmartFilter,
  today: string
) {
  const normalized = search.trim().toLowerCase()

  return rows.filter((row) => {
    const matchesSearch = !normalized || row.searchIndex.includes(normalized)

    if (!matchesSearch) {
      return false
    }

    switch (filter) {
      case "pending":
        return row.currentDue > 0
      case "overdue":
        return row.daysOverdue > 0
      case "partial":
        return row.partialPayments > 0
      case "advance":
        return row.advanceBalance > 0
      case "paid_this_month":
        return Boolean(row.lastPaymentDate && sameMonth(row.lastPaymentDate, today))
      case "new_joiners":
        return Boolean(row.resident.joined_on && sameMonth(row.resident.joined_on, today))
      case "no_payment_this_month":
        return row.currentDue > 0 && !row.hasVerifiedPaymentThisMonth
      case "high_risk":
        return row.riskScore >= 70
      default:
        return true
    }
  })
}

function financePaymentDate(payment: { created_at: string; verified_at?: string | null }) {
  return payment.verified_at ?? payment.created_at
}

function reminderMessage(row: ResidentFinanceSummary) {
  return [
    `Hello ${row.resident.full_name}, this is Sadhana Boys Hostel.`,
    `Your current hostel due is ${formatCurrency(row.currentDue)}.`,
    row.daysOverdue > 0
      ? `This payment is overdue by ${row.daysOverdue} days.`
      : "Please complete the payment by the due date.",
    "Please share payment confirmation after paying.",
  ].join(" ")
}

function tomorrowAtTen() {
  const next = new Date()

  next.setDate(next.getDate() + 1)
  next.setHours(10, 0, 0, 0)

  return next.toISOString()
}

async function copyReminder(row: ResidentFinanceSummary) {
  try {
    await navigator.clipboard.writeText(reminderMessage(row))
    toast.success("Reminder copied.")
  } catch {
    toast.error("Unable to copy reminder.")
  }
}

function sameMonth(value: string, today: string) {
  return value.slice(0, 7) === today.slice(0, 7)
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartDateOnly() {
  const now = new Date()

  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`
}
