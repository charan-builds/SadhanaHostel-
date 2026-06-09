"use client"

import { useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import {
  Banknote,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  IndianRupee,
  Loader2,
  MessageCircle,
  PhoneCall,
  ReceiptText,
  Search,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
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
  buildCollectionKpis,
  buildCollectionSections,
  filterCollectionRows,
  type CollectionDrawerTab,
  type CollectionPaymentMethod,
} from "@/lib/finance/collection-center"
import { buildFinanceTimeline, type ResidentFinanceSummary } from "@/lib/finance/finance-dashboard"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime, humanizeEnum } from "@/lib/format"
import { buildWhatsappUrl } from "@/lib/operations/whatsapp"
import { cn } from "@/lib/utils"
import { useFinanceDashboard, useInvoiceDownloadUrl, useRecordInPersonPayment, useResidentPaymentLedger } from "@/hooks"
import type { Tables } from "@/types/database"

type CollectionDialogState = {
  row: ResidentFinanceSummary
  method: CollectionPaymentMethod
} | null

type LedgerDrawerState = {
  row: ResidentFinanceSummary
  tab: CollectionDrawerTab
} | null

const todayDate = () => new Date().toISOString().slice(0, 10)

export function AdminCollectionsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [search, setSearch] = useState("")
  const [paymentDialog, setPaymentDialog] = useState<CollectionDialogState>(null)
  const [drawer, setDrawer] = useState<LedgerDrawerState>(null)
  const today = todayDate()
  const dashboard = useFinanceDashboard(
    organizationId
      ? {
          organizationId,
          hostelId,
        }
      : undefined
  )
  const finance = dashboard.data
  const filteredRows = useMemo(
    () => filterCollectionRows(finance?.residentFinance ?? [], search),
    [finance?.residentFinance, search]
  )
  const sections = useMemo(
    () => buildCollectionSections(filteredRows, today),
    [filteredRows, today]
  )
  const kpis = finance ? buildCollectionKpis(finance) : null
  const searchActive = search.trim().length > 0
  const residentById = useMemo(() => {
    return new Map(
      (finance?.residentFinance ?? []).map((row) => [row.resident.id, row])
    )
  }, [finance?.residentFinance])

  if (!organizationId) {
    return (
      <ResponsiveContainer size="wide" className="py-8">
        <EmptyState
          title="Tenant context resolving"
          message="Sadhana Boys Hostel context is being applied automatically."
        />
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 py-8">
      <PageHeader
        title="Collections"
        description="Daily collection desk for dues, reminders, receipts, and resident ledger follow-through."
        badge={finance?.aggregation.source === "database" ? "Aggregate backed" : "Snapshot"}
      />

      {dashboard.isLoading ? <LoadingState variant="dashboard" /> : null}
      {dashboard.isError ? (
        <APIErrorState
          title="Collections could not be loaded"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}

      {finance && kpis ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <CollectionKpiCard icon={IndianRupee} label="Today's Collections" value={formatCurrency(kpis.todayCollection)} />
            <CollectionKpiCard icon={Clock3} label="Pending Collections" value={formatCurrency(kpis.pendingCollection)} tone="warning" />
            <CollectionKpiCard icon={CreditCard} label="Overdue Collections" value={formatCurrency(kpis.overdueCollection)} tone="danger" />
            <CollectionKpiCard icon={FileText} label="Due Today" value={formatCurrency(kpis.dueToday)} />
            <CollectionKpiCard icon={WalletCards} label="Due This Week" value={formatCurrency(kpis.dueThisWeek)} />
            <CollectionKpiCard icon={ReceiptText} label="Collection Rate" value={`${kpis.collectionRate}%`} />
            <CollectionKpiCard icon={Clock3} label="Avg Delay" value={`${kpis.averageCollectionDelay} days`} />
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Search name, phone, admission ID, invoice, receipt, payment reference"
                aria-label="Search collection residents"
              />
            </div>
          </section>

          <section className="grid gap-5">
            {searchActive ? (
              <CollectionSectionPanel
                title="Search Results"
                rows={filteredRows}
                onRecord={(row, method) => setPaymentDialog({ row, method })}
                onOpen={(row, tab) => setDrawer({ row, tab })}
              />
            ) : null}
            {sections.map((section) => (
              <CollectionSectionPanel
                key={section.key}
                title={section.title}
                rows={section.rows}
                onRecord={(row, method) => setPaymentDialog({ row, method })}
                onOpen={(row, tab) => setDrawer({ row, tab })}
              />
            ))}
          </section>

          <RecentCollectionsPanel
            payments={finance.recentPayments}
            residentById={residentById}
            onOpen={(row) => setDrawer({ row, tab: "receipts" })}
          />
        </>
      ) : null}

      <CollectionPaymentDialog
        state={paymentDialog}
        onRecorded={(row) => {
          void dashboard.refetch()
          setDrawer({ row, tab: "receipts" })
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentDialog(null)
          }
        }}
      />
      <CollectionLedgerDrawer
        state={drawer}
        onOpenChange={(open) => {
          if (!open) {
            setDrawer(null)
          }
        }}
      />
    </ResponsiveContainer>
  )
}

function CollectionKpiCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  tone?: "default" | "warning" | "danger"
}) {
  const toneClassName = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  }[tone]

  return (
    <article className="rounded-xl border bg-card p-4 shadow-soft">
      <div className={cn("flex size-9 items-center justify-center rounded-lg", toneClassName)}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </article>
  )
}

function CollectionSectionPanel({
  title,
  rows,
  onRecord,
  onOpen,
}: {
  title: string
  rows: ResidentFinanceSummary[]
  onRecord: (row: ResidentFinanceSummary, method: CollectionPaymentMethod) => void
  onOpen: (row: ResidentFinanceSummary, tab: CollectionDrawerTab) => void
}) {
  return (
    <section className="rounded-xl border bg-card shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{rows.length} resident{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <div className="divide-y">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No residents" message="This collection queue is clear." />
          </div>
        ) : (
          rows.map((row) => (
            <CollectionResidentRow
              key={`${title}-${row.resident.id}`}
              row={row}
              onRecord={onRecord}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </section>
  )
}

function CollectionResidentRow({
  row,
  onRecord,
  onOpen,
}: {
  row: ResidentFinanceSummary
  onRecord: (row: ResidentFinanceSummary, method: CollectionPaymentMethod) => void
  onOpen: (row: ResidentFinanceSummary, tab: CollectionDrawerTab) => void
}) {
  const whatsappUrl = buildWhatsappUrl({
    phone: row.resident.phone,
    message: `Hi ${row.resident.full_name}, your current hostel due is ${formatCurrency(row.currentDue)}. Please complete the payment or contact Sadhana Hostel finance desk.`,
  })

  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,1.2fr)_repeat(2,minmax(110px,0.55fr))] xl:grid-cols-[minmax(220px,1.2fr)_repeat(4,minmax(110px,0.55fr))_minmax(420px,1.8fr)] xl:items-center">
      <div className="min-w-0">
        <p className="truncate font-semibold">{row.resident.full_name}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {row.resident.admission_number} · {row.resident.phone ?? "No phone"}
        </p>
      </div>
      <MiniMetric label="Due" value={formatCurrency(row.currentDue)} />
      <MiniMetric label="Overdue" value={formatCurrency(row.overdueAmount)} />
      <MiniMetric label="Last paid" value={row.lastPaymentDate ? formatDate(row.lastPaymentDate) : "None"} />
      <MiniMetric label="Risk" value={row.riskScore} />
      <div>
        <StatusBadge status={row.resident.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={() => onRecord(row, "cash")}>
          <Banknote className="size-3.5" aria-hidden="true" />
          Cash
        </Button>
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={() => onRecord(row, "upi")}>
          <IndianRupee className="size-3.5" aria-hidden="true" />
          UPI
        </Button>
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={() => onRecord(row, "bank_transfer")}>
          <CreditCard className="size-3.5" aria-hidden="true" />
          Bank
        </Button>
        <Button asChild size="sm" variant="outline" className="justify-start sm:justify-center" disabled={!row.resident.phone}>
          <a href={row.resident.phone ? `tel:${row.resident.phone}` : undefined}>
            <PhoneCall className="size-3.5" aria-hidden="true" />
            Call
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="justify-start sm:justify-center" disabled={!whatsappUrl}>
          <a href={whatsappUrl ?? undefined} target="_blank" rel="noreferrer">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            WhatsApp
          </a>
        </Button>
        <Button size="sm" className="justify-start sm:justify-center" onClick={() => onOpen(row, "ledger")}>
          <Eye className="size-3.5" aria-hidden="true" />
          Ledger
        </Button>
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={() => onOpen(row, "invoices")}>
          Invoices
        </Button>
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={() => onOpen(row, "receipts")}>
          Receipts
        </Button>
      </div>
    </article>
  )
}

function CollectionPaymentDialog({
  state,
  onRecorded,
  onOpenChange,
}: {
  state: CollectionDialogState
  onRecorded: (row: ResidentFinanceSummary) => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      {state ? (
        <CollectionPaymentDialogBody
          key={`${state.row.resident.id}-${state.method}-${state.row.primaryDueRecordId ?? "advance"}`}
          state={state}
          onRecorded={onRecorded}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  )
}

function CollectionPaymentDialogBody({
  state,
  onRecorded,
  onOpenChange,
}: {
  state: NonNullable<CollectionDialogState>
  onRecorded: (row: ResidentFinanceSummary) => void
  onOpenChange: (open: boolean) => void
}) {
  const initialAmount = state.row.primaryDueBalance || state.row.currentDue
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "")
  const [selectedMethod, setSelectedMethod] = useState<CollectionPaymentMethod>(state.method)
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const recordPayment = useRecordInPersonPayment()
  const row = state.row
  const method = selectedMethod
  const payableDue = row?.primaryDueBalance ?? row?.currentDue ?? 0
  const numericAmount = Number(amount || 0)
  const isAdvance = Boolean(row && !row.primaryDueRecordId)
  const isPartial = Boolean(row && row.primaryDueRecordId && numericAmount < payableDue)
  const tooHigh = Boolean(row?.primaryDueRecordId && numericAmount > payableDue)

  async function submit() {
    if (numericAmount <= 0) {
      return
    }

    if (tooHigh) {
      toast.error("Record the current due first, then add extra amount as advance.")
      return
    }

    await recordPayment.mutateAsync({
      organizationId: row.resident.organization_id,
      hostelId: row.resident.hostel_id,
      residentId: row.resident.id,
      amount: numericAmount,
      method,
      manualReference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      isAdvance,
      isPartial,
      ...(row.primaryDueRecordId ? { monthlyFeeRecordId: row.primaryDueRecordId } : {}),
    })
    toast.success(`${method === "bank_transfer" ? "Bank" : humanizeEnum(method)} collection recorded. Receipt and invoice links are ready.`)
    onRecorded(row)
    onOpenChange(false)
  }

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Record {method === "bank_transfer" ? "Bank" : humanizeEnum(method)} Payment</DialogTitle>
        <DialogDescription>
          {row.resident.full_name} · Current due {formatCurrency(row.currentDue)}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="collection-method">Payment method</Label>
          <Select
            value={method}
            onValueChange={(value) => setSelectedMethod(value as CollectionPaymentMethod)}
          >
            <SelectTrigger id="collection-method" className="w-full">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="collection-amount">Amount received</Label>
          <Input
            id="collection-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          {tooHigh ? (
            <p className="text-sm text-destructive">
              Amount exceeds selected due of {formatCurrency(payableDue)}.
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="collection-reference">Reference number</Label>
          <Input
            id="collection-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={method === "cash" ? "Receipt book / cash note" : "UTR / transaction ID"}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="collection-notes">Notes</Label>
          <Textarea
            id="collection-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Counter collection note"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={recordPayment.isPending || numericAmount <= 0 || tooHigh}
          onClick={() => void submit()}
        >
          {recordPayment.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ReceiptText className="size-4" aria-hidden="true" />
          )}
          Record Payment
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function CollectionLedgerDrawer({
  state,
  onOpenChange,
}: {
  state: LedgerDrawerState
  onOpenChange: (open: boolean) => void
}) {
  const row = state?.row
  const ledger = useResidentPaymentLedger(
    row
      ? {
          organizationId: row.resident.organization_id,
          residentId: row.resident.id,
        }
      : undefined
  )
  const downloadInvoice = useInvoiceDownloadUrl()
  const detailLedger = ledger.data
  const timeline = detailLedger ? buildFinanceTimeline([detailLedger], 12) : []

  async function download(invoice: Tables<"invoices">) {
    const result = await downloadInvoice.mutateAsync({
      organizationId: invoice.organization_id,
      invoiceId: invoice.id,
      expiresInSeconds: 900,
    })

    window.open(result.downloadUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <Sheet open={Boolean(state)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        {row ? (
          <>
            <SheetHeader className="border-b p-6 text-left">
              <SheetTitle>{row.resident.full_name}</SheetTitle>
              <SheetDescription>
                {row.resident.admission_number} · {formatCurrency(row.currentDue)} due
              </SheetDescription>
            </SheetHeader>
            <div className="p-6">
              <Tabs defaultValue={state?.tab ?? "ledger"}>
                <TabsList className="w-full overflow-x-auto">
                  <TabsTrigger value="ledger">Ledger</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                  <TabsTrigger value="receipts">Receipts</TabsTrigger>
                </TabsList>
                <DrawerTab value="ledger" loading={ledger.isLoading} loaded={Boolean(detailLedger)}>
                  <div className="grid gap-3">
                    {timeline.map((event) => (
                      <div key={event.id} className="rounded-lg border bg-card p-3">
                        <p className="font-medium">{event.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {event.description} · {formatDateTime(event.occurredAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </DrawerTab>
                <DrawerTab value="payments" loading={ledger.isLoading} loaded={Boolean(detailLedger)}>
                  <FinanceRows
                    rows={(detailLedger?.payments ?? []).map((payment) => ({
                      id: payment.id,
                      title: formatCurrency(payment.amount),
                      detail: `${humanizeEnum(payment.method)} · ${formatDateTime(payment.verified_at ?? payment.paid_at ?? payment.created_at)}`,
                      status: payment.status,
                    }))}
                  />
                </DrawerTab>
                <DrawerTab value="invoices" loading={ledger.isLoading} loaded={Boolean(detailLedger)}>
                  <InvoiceRows
                    invoices={detailLedger?.invoices ?? []}
                    downloading={downloadInvoice.isPending}
                    onDownload={(invoice) => void download(invoice)}
                  />
                </DrawerTab>
                <DrawerTab value="receipts" loading={ledger.isLoading} loaded={Boolean(detailLedger)}>
                  <InvoiceRows
                    invoices={(detailLedger?.invoices ?? []).filter(
                      (invoice) => invoice.status === "paid" || invoice.paid_amount > 0
                    )}
                    downloading={downloadInvoice.isPending}
                    onDownload={(invoice) => void download(invoice)}
                  />
                </DrawerTab>
              </Tabs>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function DrawerTab({
  value,
  loading,
  loaded,
  children,
}: {
  value: string
  loading: boolean
  loaded: boolean
  children: ReactNode
}) {
  return (
    <TabsContent value={value} className="mt-4">
      {loading ? <LoadingState variant="cards" /> : null}
      {!loading && !loaded ? (
        <EmptyState title="Ledger not loaded" message="Resident finance details load on demand." />
      ) : null}
      {!loading && loaded ? children : null}
    </TabsContent>
  )
}

function InvoiceRows({
  invoices,
  downloading,
  onDownload,
}: {
  invoices: Tables<"invoices">[]
  downloading: boolean
  onDownload: (invoice: Tables<"invoices">) => void
}) {
  if (invoices.length === 0) {
    return <EmptyState title="No invoices" message="Invoices and receipts appear after verified collections." />
  }

  return (
    <div className="grid gap-3">
      {invoices.map((invoice) => (
        <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{invoice.invoice_number}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(invoice.total_amount)} · {formatDate(invoice.issue_date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.status} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={downloading || !invoice.pdf_storage_path}
              onClick={() => onDownload(invoice)}
            >
              Download
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function FinanceRows({
  rows,
}: {
  rows: Array<{ id: string; title: string; detail: string; status: string }>
}) {
  if (rows.length === 0) {
    return <EmptyState title="No records" message="Records appear as finance activity grows." />
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

function RecentCollectionsPanel({
  payments,
  residentById,
  onOpen,
}: {
  payments: Tables<"payments">[]
  residentById: Map<string, ResidentFinanceSummary>
  onOpen: (row: ResidentFinanceSummary) => void
}) {
  return (
    <section className="rounded-xl border bg-card shadow-soft">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Recent Collections</h2>
      </div>
      <div className="divide-y">
        {payments.slice(0, 10).map((payment) => {
          const row = residentById.get(payment.resident_id)

          return (
            <article key={payment.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{row?.resident.full_name ?? "Resident"}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(payment.amount)} · {humanizeEnum(payment.method)} ·{" "}
                  {formatDateTime(payment.verified_at ?? payment.paid_at ?? payment.created_at)}
                </p>
              </div>
              {row ? (
                <Button type="button" variant="outline" onClick={() => onOpen(row)}>
                  View Receipts
                </Button>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}
