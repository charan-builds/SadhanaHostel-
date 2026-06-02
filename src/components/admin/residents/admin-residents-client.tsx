"use client"

import Link from "next/link"
import type { Route } from "next"
import {
  Banknote,
  Bell,
  CalendarDays,
  CreditCard,
  Edit,
  Eye,
  IdCard,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  UserX,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { motion, type Variants } from "framer-motion"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ResidentForm } from "@/components/admin/residents/resident-form"
import { ResidentInviteDialog } from "@/components/admin/residents/resident-invite-dialog"
import { DataTableShell } from "@/components/shared/data-table-shell"
import { LoadingState } from "@/components/shared/loading-state"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format"
import { buildWhatsappUrl } from "@/lib/operations/whatsapp"
import {
  formatResidentIdentityMode,
  getResidentIdentityMode,
} from "@/lib/resident-identity"
import { useRealtimeAdmissions } from "@/lib/realtime"
import {
  useCheckoutResident,
  useDashboardAnalytics,
  useDeactivateResident,
  useGenerateMonthlyFee,
  useRecordInPersonPayment,
  useResidentPaymentLedger,
  useResidentPaymentLedgers,
  useRepairResidentLifecycle,
  useResidents,
  useRunAutomation,
} from "@/hooks"
import type { Tables } from "@/types/database"
import type { ResidentPaymentLedger } from "@/types/payment-operations"

type ResidentStatusFilter = "all" | "draft" | "active" | "suspended" | "checked_out" | "archived"
type ResidentTypeFilter = "all" | "student" | "employee" | "other"
type ResidentLedgerQuery = {
  data?: ResidentPaymentLedger
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  refetch: () => Promise<unknown>
}

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const reveal: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

export function AdminResidentsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<ResidentStatusFilter>("all")
  const [residentType, setResidentType] = useState<ResidentTypeFilter>("all")
  const [page, setPage] = useState(1)
  const [editingResident, setEditingResident] = useState<Tables<"residents"> | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Tables<"residents"> | null>(null)
  const [checkoutTarget, setCheckoutTarget] = useState<Tables<"residents"> | null>(null)
  const [inviteTarget, setInviteTarget] = useState<Tables<"residents"> | null>(null)
  const [repairTarget, setRepairTarget] = useState<Tables<"residents"> | null>(null)
  const [profileTarget, setProfileTarget] = useState<Tables<"residents"> | null>(null)
  const deactivateResident = useDeactivateResident()
  const checkoutResident = useCheckoutResident()
  const repairResidentLifecycle = useRepairResidentLifecycle()
  const runAutomation = useRunAutomation()
  const analytics = useDashboardAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const query = useResidents({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: 20,
    search: search || undefined,
    status: status === "all" ? undefined : status,
    residentType: residentType === "all" ? undefined : residentType,
  })
  const residentRows = useMemo(() => query.data?.data ?? [], [query.data?.data])
  const residentIds = useMemo(
    () => residentRows.map((resident) => resident.id),
    [residentRows]
  )
  const residentLedgerQueries = useResidentPaymentLedgers({
    organizationId: organizationId ?? undefined,
    residentIds,
  })

  const summary = useMemo(() => {
    const rows = residentRows
    const lifecycle = analytics.data?.residentLifecycle

    return {
      registered: analytics.data?.totalResidents ?? query.data?.meta.total ?? 0,
      active: lifecycle?.activeResidents ?? rows.filter((resident) => resident.status === "active").length,
      onboarding:
        lifecycle?.onboardingResidents ??
        rows.filter((resident) => resident.status === "draft").length,
      verified:
        lifecycle?.verifiedResidents ?? rows.filter((resident) => resident.status === "active").length,
      suspended:
        lifecycle?.suspendedResidents ??
        rows.filter((resident) => resident.status === "suspended").length,
      checkedOut:
        lifecycle?.checkedOutResidents ??
        rows.filter((resident) => resident.status === "checked_out").length,
      pendingVerification:
        lifecycle?.pendingVerification ??
        rows.filter((resident) => !resident.aadhaar_document_id).length,
      monthlyFees: rows.reduce((total, resident) => total + resident.monthly_fee_amount, 0),
    }
  }, [analytics.data, query.data?.meta.total, residentRows])

  async function confirmDeactivate() {
    if (!organizationId || !deactivateTarget) {
      return
    }

    await deactivateResident.mutateAsync({
      residentId: deactivateTarget.id,
      organizationId,
    })
    toast.success("Resident deactivated.")
    setDeactivateTarget(null)
  }

  async function confirmCheckout() {
    if (!organizationId || !checkoutTarget) {
      return
    }

    await checkoutResident.mutateAsync({
      residentId: checkoutTarget.id,
      organizationId,
      checkoutDate: new Date().toISOString().slice(0, 10),
      reason: "Resident left the hostel from admin residents table.",
    })
    toast.success("Resident marked as left and room occupancy released.")
    setCheckoutTarget(null)
  }

  async function confirmRepair() {
    if (!organizationId || !repairTarget) {
      return
    }

    const result = await repairResidentLifecycle.mutateAsync({
      residentId: repairTarget.id,
      organizationId,
      dryRun: false,
    })
    const repairCount = Object.values(result.repairs).reduce(
      (total, value) => total + (typeof value === "number" ? value : 0),
      0
    )

    toast.success(
      repairCount > 0
        ? `Resident lifecycle repaired (${repairCount} updates applied).`
        : "Resident lifecycle checked. No repair was needed."
    )
    setRepairTarget(null)
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
          periodMonth: currentPeriodMonth(),
        },
      })

      await query.refetch()
      await Promise.all(residentLedgerQueries.map((ledgerQuery) => ledgerQuery.refetch()))
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
          dueBeforeDate: todayDateOnly(),
          limit: 200,
        },
      })

      toast.success(result.result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to queue payment reminders.")
    }
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Residents"
        description="Manage resident profiles, onboarding details, fees, and account status."
        actions={
          <div className="flex flex-wrap gap-2">
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
              variant="outline"
              disabled={runAutomation.isPending}
              onClick={() => void queuePaymentReminders()}
            >
              <Bell className="size-4" aria-hidden="true" />
              Bulk reminders
            </Button>
            <Button asChild>
              <Link href={"/admin/residents/new" as Route}>
                <Plus className="size-4" aria-hidden="true" />
                Add Resident
              </Link>
            </Button>
          </div>
        }
      />

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard label="Registered Residents" value={summary.registered} icon={Users} tone="info" />
        <SummaryCard label="Active Residents" value={summary.active} icon={ShieldCheck} tone="success" />
        <SummaryCard label="Draft / Onboarding" value={summary.onboarding} icon={KeyRound} tone="warning" />
        <SummaryCard label="Verified Residents" value={summary.verified} icon={IdCard} tone="success" />
        <SummaryCard label="Onboarding Follow-up" value={summary.pendingVerification} icon={Wrench} tone="warning" />
        <SummaryCard label="Suspended Residents" value={summary.suspended} icon={UserX} tone="danger" />
        <SummaryCard label="Left Residents" value={summary.checkedOut} icon={LogOut} tone="neutral" />
        <SummaryCard label="Monthly Fees on This Page" value={formatCurrency(summary.monthlyFees)} icon={CreditCard} tone="info" />
      </motion.section>

      {query.error ? (
        <APIErrorState
          title="Residents failed to load"
          message="Check filters or retry the request."
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.error ? (
        <ResidentPaymentOverview
          residents={residentRows}
          ledgerQueries={residentLedgerQueries}
          isLoading={query.isLoading}
          onOpenResident={(resident) => setProfileTarget(resident)}
        />
      ) : null}

      <DataTableShell
        title="Resident Records"
        description="Server-side search, filters, pagination, and production API actions."
        empty={
          residentRows.length === 0 ? (
            <EmptyState
              title={search || status !== "all" || residentType !== "all" ? "No residents match these filters" : "No residents yet"}
              message={
                search || status !== "all" || residentType !== "all"
                  ? "Clear filters to return to the full resident list."
                  : "Create your first resident after admission approval, then send an activation invite."
              }
              action={
                search || status !== "all" || residentType !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("")
                      setStatus("all")
                      setResidentType("all")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href={"/admin/residents/new" as Route}>Add resident</Link>
                  </Button>
                )
              }
            />
          ) : undefined
        }
      >
        <motion.div layout className="grid gap-3 border-b bg-white/45 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <label className="relative">
            <span className="sr-only">Search residents</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              className="pl-8"
              placeholder="Search name, phone, email, admission"
            />
          </label>
          <Select value={residentType} onValueChange={(value) => setResidentType(value as ResidentTypeFilter)}>
            <SelectTrigger className="h-9 min-w-40" aria-label="Filter resident type">
              <SelectValue placeholder="Resident type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as ResidentStatusFilter)}>
            <SelectTrigger className="h-9 min-w-40" aria-label="Filter resident status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="checked_out">Left hostel</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {query.isLoading ? (
          <LoadingState variant="table" />
        ) : (
          <div className="grid gap-5 p-4">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {residentRows.slice(0, 6).map((resident) => (
                <ResidentProfileTile
                  key={resident.id}
                  resident={resident}
                  onPreview={() => setProfileTarget(resident)}
                  onEdit={() => setEditingResident(resident)}
                  onInvite={() => setInviteTarget(resident)}
                  onRepair={() => setRepairTarget(resident)}
                  onCheckout={() => setCheckoutTarget(resident)}
                  onDeactivate={() => setDeactivateTarget(resident)}
                  repairDisabled={repairResidentLifecycle.isPending}
                />
              ))}
            </motion.div>

            <div className="overflow-hidden rounded-xl border bg-white/55">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident</TableHead>
                    <TableHead>Admission</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Portal Access</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {residentRows.map((resident) => (
                    <TableRow key={resident.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <ResidentAvatar resident={resident} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{resident.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {resident.email ?? resident.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{resident.admission_number}</TableCell>
                      <TableCell className="capitalize">{resident.resident_type}</TableCell>
                      <TableCell>{resident.phone ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">
                            {formatResidentIdentityMode(getResidentIdentityMode(resident))}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {resident.user_id ? "Auth linked" : "Activation pending"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(resident.monthly_fee_amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={resident.status} />
                      </TableCell>
                      <TableCell>{formatDate(resident.joined_on ?? resident.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <ResidentActionMenu
                          resident={resident}
                          onPreview={() => setProfileTarget(resident)}
                          onEdit={() => setEditingResident(resident)}
                          onInvite={() => setInviteTarget(resident)}
                          onRepair={() => setRepairTarget(resident)}
                          onCheckout={() => setCheckoutTarget(resident)}
                          onDeactivate={() => setDeactivateTarget(resident)}
                          repairDisabled={repairResidentLifecycle.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {query.data?.meta.page ?? page} of {query.data?.meta.totalPages ?? 1}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={(query.data?.meta.totalPages ?? 1) <= page || query.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </DataTableShell>

      <ResidentProfileSheet
        resident={profileTarget}
        open={Boolean(profileTarget)}
        onOpenChange={(open) => !open && setProfileTarget(null)}
        onEdit={() => {
          if (profileTarget) {
            setEditingResident(profileTarget)
            setProfileTarget(null)
          }
        }}
        onInvite={() => {
          if (profileTarget) {
            setInviteTarget(profileTarget)
            setProfileTarget(null)
          }
        }}
      />

      <Dialog open={Boolean(editingResident)} onOpenChange={(open) => !open && setEditingResident(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit resident</DialogTitle>
            <DialogDescription>Update allowed resident profile and fee fields.</DialogDescription>
          </DialogHeader>
          {editingResident ? (
            <ResidentEditForm
              resident={editingResident}
              onSaved={() => {
                setEditingResident(null)
                void query.refetch()
              }}
              onCancel={() => setEditingResident(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(checkoutTarget)}
        onOpenChange={(open) => !open && setCheckoutTarget(null)}
        title={`Mark ${checkoutTarget?.full_name ?? "resident"} as left?`}
        description="This releases the active room allocation, updates vacancy, and keeps the resident record visible for operational history."
        confirmLabel={checkoutResident.isPending ? "Marking left..." : "Mark left"}
        onConfirm={confirmCheckout}
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={`Deactivate ${deactivateTarget?.full_name ?? "resident"}?`}
        description="The resident will be archived through the production API. Financial records remain immutable."
        confirmLabel={deactivateResident.isPending ? "Deactivating..." : "Deactivate"}
        variant="danger"
        onConfirm={confirmDeactivate}
      />

      <ConfirmDialog
        open={Boolean(repairTarget)}
        onOpenChange={(open) => !open && setRepairTarget(null)}
        title={`Repair lifecycle for ${repairTarget?.full_name ?? "resident"}?`}
        description="This safely checks auth linkage, duplicate invites, stale onboarding, active allocations, invalid dues, and occupancy snapshots for this resident. All changes are tenant-scoped and audit logged."
        confirmLabel={repairResidentLifecycle.isPending ? "Repairing..." : "Repair lifecycle"}
        onConfirm={confirmRepair}
      />

      <ResidentInviteDialog
        open={Boolean(inviteTarget)}
        onOpenChange={(open) => !open && setInviteTarget(null)}
        resident={inviteTarget}
        organizationId={organizationId}
      />
    </ResponsiveContainer>
  )
}

function ResidentPaymentOverview({
  residents,
  ledgerQueries,
  isLoading,
  onOpenResident,
}: {
  residents: Tables<"residents">[]
  ledgerQueries: ResidentLedgerQuery[]
  isLoading: boolean
  onOpenResident: (resident: Tables<"residents">) => void
}) {
  const overviewRows = residents.map((resident, index) => {
    const ledgerQuery = ledgerQueries[index]
    const snapshot = ledgerQuery?.data
      ? getResidentFinanceSnapshot(resident, ledgerQuery.data)
      : null

    return {
      resident,
      ledgerQuery,
      snapshot,
    }
  })
  const loadedSnapshots = overviewRows
    .map((row) => row.snapshot)
    .filter((snapshot): snapshot is ResidentFinanceSnapshot => Boolean(snapshot))
  const totals = loadedSnapshots.reduce(
    (total, snapshot) => ({
      dueLeft: total.dueLeft + snapshot.dueLeft,
      pendingVerification:
        total.pendingVerification + snapshot.pendingVerification,
      advanceLeft: total.advanceLeft + snapshot.advanceLeft,
      partialResidents:
        total.partialResidents + (snapshot.status === "partial" ? 1 : 0),
    }),
    {
      dueLeft: 0,
      pendingVerification: 0,
      advanceLeft: 0,
      partialResidents: 0,
    }
  )

  if (!isLoading && residents.length === 0) {
    return null
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-white/65 shadow-soft">
      <div className="border-b p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Payment overview
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Monthly dues and advance status
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <CompactFinanceMetric label="Monthly due" value={formatCurrency(totals.dueLeft)} />
            <CompactFinanceMetric label="Pending" value={formatCurrency(totals.pendingVerification)} />
            <CompactFinanceMetric label="Advance left" value={formatCurrency(totals.advanceLeft)} />
            <CompactFinanceMetric label="Partial" value={totals.partialResidents} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState variant="table" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resident</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Monthly payment</TableHead>
                <TableHead>Paid / pending</TableHead>
                <TableHead>Advance</TableHead>
                <TableHead>Total left</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ledger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overviewRows.map(({ resident, ledgerQuery, snapshot }) => {
                const reminderUrl = snapshot
                  ? buildResidentReminderUrl(resident, snapshot)
                  : null

                return (
                  <TableRow key={resident.id}>
                    <TableCell>
                      <div className="flex min-w-52 items-center gap-3">
                        <ResidentAvatar resident={resident} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {resident.full_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {resident.admission_number}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{resident.phone ?? "-"}</TableCell>
                    <TableCell>{formatDate(resident.joined_on ?? resident.created_at)}</TableCell>
                    <TableCell>{formatCurrency(resident.monthly_fee_amount)}</TableCell>
                    {snapshot ? (
                      <>
                        <TableCell>
                          <StackedMoneyLine
                            primary={`Paid ${formatCurrency(snapshot.paidThisMonth)}`}
                            secondary={`Pending ${formatCurrency(snapshot.pendingVerification)}`}
                          />
                        </TableCell>
                        <TableCell>
                          <StackedMoneyLine
                            primary={`Paid ${formatCurrency(snapshot.advancePaid)}`}
                            secondary={`Left ${formatCurrency(snapshot.advanceLeft)}`}
                          />
                        </TableCell>
                        <TableCell>
                          <StackedMoneyLine
                            primary={formatCurrency(snapshot.reminderAmount)}
                            secondary={`Last date ${formatDate(snapshot.dueDate)}`}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={snapshot.status} />
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell colSpan={4}>
                          <span className="text-sm text-muted-foreground">
                            {ledgerQuery?.isError ? "Ledger unavailable" : "Loading ledger"}
                          </span>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {reminderUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={reminderUrl} target="_blank" rel="noreferrer">
                              <MessageCircle className="size-3.5" aria-hidden="true" />
                              Send due
                            </a>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="outline" disabled>
                            <MessageCircle className="size-3.5" aria-hidden="true" />
                            Send due
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenResident(resident)}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          Open
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

function CompactFinanceMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background/70 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function StackedMoneyLine({
  primary,
  secondary,
}: {
  primary: string
  secondary: string
}) {
  return (
    <div className="min-w-32">
      <p className="text-sm font-medium text-foreground">{primary}</p>
      <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
    </div>
  )
}

function ResidentEditForm({
  resident,
  onSaved,
  onCancel,
}: {
  resident: Tables<"residents">
  onSaved: () => void
  onCancel: () => void
}) {
  return <ResidentForm resident={resident} onSaved={onSaved} onCancel={onCancel} />
}

function ResidentAvatar({ resident, className }: { resident: Tables<"residents">; className?: string }) {
  const initials = resident.full_name
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

function ResidentProfileTile({
  resident,
  onPreview,
  onEdit,
  onInvite,
  onRepair,
  onCheckout,
  onDeactivate,
  repairDisabled,
}: {
  resident: Tables<"residents">
  onPreview: () => void
  onEdit: () => void
  onInvite: () => void
  onRepair: () => void
  onCheckout: () => void
  onDeactivate: () => void
  repairDisabled: boolean
}) {
  return (
    <motion.article variants={reveal} layout>
      <div className="group h-full rounded-xl border bg-card/90 p-4 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onPreview}
            className="flex min-w-0 items-center gap-3 text-left focus-ring"
          >
            <ResidentAvatar resident={resident} className="size-12" />
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-foreground">
                {resident.full_name}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {resident.admission_number}
              </span>
            </span>
          </button>
          <ResidentActionMenu
            resident={resident}
            onPreview={onPreview}
            onEdit={onEdit}
            onInvite={onInvite}
            onRepair={onRepair}
            onCheckout={onCheckout}
            onDeactivate={onDeactivate}
            repairDisabled={repairDisabled}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={resident.status} />
          <Badge variant="secondary" className="capitalize">{resident.resident_type}</Badge>
          <Badge variant="outline">
            {formatResidentIdentityMode(getResidentIdentityMode(resident))}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
          <ResidentInfoLine icon={Phone} value={resident.phone ?? "No phone"} />
          <ResidentInfoLine icon={Mail} value={resident.email ?? "No email"} />
          <ResidentInfoLine
            icon={CreditCard}
            value={`${formatCurrency(resident.monthly_fee_amount)} monthly`}
          />
          <ResidentInfoLine
            icon={CalendarDays}
            value={`Joined ${formatDate(resident.joined_on ?? resident.created_at)}`}
          />
        </div>

        <div className="mt-4 rounded-xl border bg-white/55 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Portal access</span>
            <span className="text-xs font-medium text-foreground">
              {resident.user_id ? "Auth linked" : "Activation pending"}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function ResidentActionMenu({
  resident,
  onPreview,
  onEdit,
  onInvite,
  onRepair,
  onCheckout,
  onDeactivate,
  repairDisabled,
}: {
  resident: Tables<"residents">
  onPreview: () => void
  onEdit: () => void
  onInvite: () => void
  onRepair: () => void
  onCheckout: () => void
  onDeactivate: () => void
  repairDisabled: boolean
}) {
  const checkedOut = resident.status === "checked_out" || resident.status === "archived"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Open actions for ${resident.full_name}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Resident actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPreview}>
          <Eye className="size-4" aria-hidden="true" />
          Preview profile
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/residents/${resident.id}` as Route}>
            <UserRound className="size-4" aria-hidden="true" />
            Open full profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="size-4" aria-hidden="true" />
          Edit resident
        </DropdownMenuItem>
        <DropdownMenuItem disabled={Boolean(resident.user_id)} onClick={onInvite}>
          <KeyRound className="size-4" aria-hidden="true" />
          Send invite
        </DropdownMenuItem>
        <DropdownMenuItem disabled={repairDisabled} onClick={onRepair}>
          <Wrench className="size-4" aria-hidden="true" />
          Repair lifecycle
        </DropdownMenuItem>
        <DropdownMenuItem disabled={checkedOut} onClick={onCheckout}>
          <LogOut className="size-4" aria-hidden="true" />
          Mark left
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDeactivate}>
          <UserX className="size-4" aria-hidden="true" />
          Deactivate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ResidentProfileSheet({
  resident,
  open,
  onOpenChange,
  onEdit,
  onInvite,
}: {
  resident: Tables<"residents"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onInvite: () => void
}) {
  const { organizationId } = useAuth()
  const ledger = useResidentPaymentLedger(
    organizationId && resident
      ? {
          organizationId,
          residentId: resident.id,
        }
      : undefined
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        {resident ? (
          <>
            <SheetHeader className="border-b p-6 text-left">
              <div className="flex items-start gap-4">
                <ResidentAvatar resident={resident} className="size-14" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl">{resident.full_name}</SheetTitle>
                  <SheetDescription className="mt-1">
                    {resident.admission_number} · {resident.resident_type}
                  </SheetDescription>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={resident.status} />
                    <Badge variant="secondary">
                      {resident.user_id ? "Auth linked" : "Activation pending"}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="grid gap-5 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileMetric label="Monthly fee" value={formatCurrency(resident.monthly_fee_amount)} />
                <ProfileMetric label="Joined" value={formatDate(resident.joined_on ?? resident.created_at)} />
                <ProfileMetric label="Identity mode" value={formatResidentIdentityMode(getResidentIdentityMode(resident))} />
                <ProfileMetric label="Resident type" value={resident.resident_type} />
              </div>

              <ResidentFinancePanel
                resident={resident}
                organizationId={organizationId}
                ledger={ledger.data}
                isLoading={ledger.isLoading}
                isError={ledger.isError}
                onRetry={() => void ledger.refetch()}
                onSaved={() => void ledger.refetch()}
              />

              <section className="rounded-xl border bg-white/55 p-4">
                <h3 className="text-sm font-semibold text-foreground">Contact</h3>
                <div className="mt-4 grid gap-3">
                  <ResidentInfoLine icon={Phone} value={resident.phone ?? "No phone"} />
                  <ResidentInfoLine icon={Mail} value={resident.email ?? "No email"} />
                  <ResidentInfoLine icon={IdCard} value={resident.id} />
                </div>
              </section>

              <section className="rounded-xl border bg-white/55 p-4">
                <h3 className="text-sm font-semibold text-foreground">Lifecycle</h3>
                <div className="mt-4 grid gap-3 text-sm">
                  <TimelineRow label="Created" value={formatDate(resident.created_at)} />
                  <TimelineRow label="Updated" value={formatDate(resident.updated_at)} />
                  <TimelineRow
                    label="Portal"
                    value={resident.user_id ? "Linked to auth user" : "Invite required"}
                  />
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onEdit}>
                  <Edit className="size-4" aria-hidden="true" />
                  Edit resident
                </Button>
                <Button variant="outline" disabled={Boolean(resident.user_id)} onClick={onInvite}>
                  <KeyRound className="size-4" aria-hidden="true" />
                  Invite
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/admin/residents/${resident.id}` as Route}>
                    <Eye className="size-4" aria-hidden="true" />
                    Full profile
                  </Link>
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ResidentFinancePanel({
  resident,
  organizationId,
  ledger,
  isLoading,
  isError,
  onRetry,
  onSaved,
}: {
  resident: Tables<"residents">
  organizationId?: string | null
  ledger?: ResidentPaymentLedger
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onSaved: () => void
}) {
  if (isLoading) {
    return (
      <section className="rounded-xl border bg-white/55 p-4">
        <LoadingState variant="cards" rows={1} />
      </section>
    )
  }

  if (isError) {
    return (
      <APIErrorState
        title="Resident finance could not be loaded"
        message="Retry to load dues, paid amount, and transactions for this resident."
        onRetry={onRetry}
      />
    )
  }

  if (!ledger) {
    return (
      <EmptyState
        title="No ledger loaded"
        message="Open this resident again after their finance records are available."
      />
    )
  }

  const currentPeriod = currentPeriodMonth()
  const currentRecord =
    ledger.feeRecords.find((record) => record.period_month === currentPeriod) ??
    ledger.primaryDueRecord
  const currentPayments = ledger.payments.filter((payment) =>
    currentRecord
      ? payment.monthly_fee_record_id === currentRecord.id
      : isSameMonth(payment.created_at, new Date())
  )
  const paidThisMonth = currentPayments
    .filter((payment) => payment.status === "verified" && !payment.is_advance)
    .reduce((total, payment) => total + payment.amount, 0)
  const pendingThisMonth = currentPayments
    .filter(
      (payment) =>
        !payment.is_advance &&
        (payment.status === "pending" || payment.status === "initiated")
    )
    .reduce((total, payment) => total + payment.amount, 0)
  const advanceAppliedToCurrentRecord = currentRecord
    ? currentPayments.some((payment) => payment.status === "verified" && payment.is_advance)
    : false
  const thisMonthLeft =
    currentRecord && !advanceAppliedToCurrentRecord
      ? currentRecord.balance_amount
      : Math.max(
          (currentRecord?.total_amount ?? resident.monthly_fee_amount) -
            paidThisMonth -
            pendingThisMonth,
          0
        )
  const recordableDueRecord =
    currentRecord &&
    ((["pending", "partial", "overdue"].includes(currentRecord.status) &&
      currentRecord.balance_amount > 0) ||
      (advanceAppliedToCurrentRecord && thisMonthLeft > 0))
      ? currentRecord
      : null
  const recordableDueAmount = recordableDueRecord
    ? Math.max(
        (advanceAppliedToCurrentRecord
          ? thisMonthLeft
          : recordableDueRecord.balance_amount) - pendingThisMonth,
        0
      )
    : 0
  const advanceRequired = resident.monthly_fee_amount
  const advancePaid = ledger.totals.advanceBalance
  const advanceLeft = Math.max(advanceRequired - advancePaid, 0)
  const dueLeft = currentRecord ? Math.max(ledger.totals.currentDue, thisMonthLeft) : thisMonthLeft
  const dueDate = recordableDueRecord?.due_date ?? currentRecord?.due_date ?? buildMonthlyDueDate(currentPeriod)
  const reminderAmount = dueLeft + advanceLeft
  const reminderMessage = buildAdminPaymentReminderMessage({
    resident,
    periodMonth: currentRecord?.period_month ?? currentPeriod,
    dueDate,
    monthlyFee: resident.monthly_fee_amount,
    paidThisMonth,
    pendingThisMonth,
    dueLeft,
    advanceLeft,
  })
  const whatsappUrl = buildWhatsappUrl({
    phone: resident.phone,
    message: reminderMessage,
  })

  async function copyReminder() {
    try {
      await navigator.clipboard.writeText(reminderMessage)
      toast.success("Payment reminder copied.")
    } catch {
      toast.error("Copy failed. Select and copy the reminder manually.")
    }
  }

  return (
    <section className="rounded-xl border bg-white/55 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Fees and payment ledger</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Billing starts from {formatDate(resident.joined_on ?? resident.created_at)}.
            One-month advance is required before stay continuity.
          </p>
        </div>
        <StatusBadge status={dueLeft > 0 || advanceLeft > 0 ? "pending" : "paid"} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ProfileMetric label="This month fee" value={formatCurrency(currentRecord?.total_amount ?? resident.monthly_fee_amount)} />
        <ProfileMetric label="Paid this month" value={formatCurrency(paidThisMonth)} />
        <ProfileMetric label="Left this month" value={formatCurrency(thisMonthLeft)} />
        <ProfileMetric label="Pending verification" value={formatCurrency(ledger.totals.pendingVerification)} />
        <ProfileMetric label="Total due left" value={formatCurrency(dueLeft)} />
        <ProfileMetric label="Total paid" value={formatCurrency(ledger.totals.verifiedPaid)} />
        <ProfileMetric label="Advance required" value={formatCurrency(advanceRequired)} />
        <ProfileMetric label="Advance left" value={formatCurrency(advanceLeft)} />
      </div>

      <div className="mt-4 rounded-xl border bg-background/70 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Reminder amount</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(reminderAmount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes unpaid dues and one-month advance balance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {recordableDueRecord && recordableDueAmount > 0 && advanceLeft > 0 ? (
              <RecordInitialCollectionDialog
                organizationId={organizationId}
                resident={resident}
                dueRecord={recordableDueRecord}
                dueAmount={recordableDueAmount}
                advanceAmount={advanceLeft}
                onSaved={onSaved}
              />
            ) : null}
            <RecordInPersonPaymentDialog
              organizationId={organizationId}
              resident={resident}
              dueRecord={recordableDueRecord}
              defaultAmount={recordableDueRecord ? recordableDueAmount : dueLeft}
              mode="due"
              periodMonth={recordableDueRecord?.period_month ?? currentPeriod}
              dueDate={dueDate}
              disabled={
                !organizationId ||
                (recordableDueRecord ? recordableDueAmount <= 0 : dueLeft <= 0)
              }
              onSaved={onSaved}
            />
            <RecordInPersonPaymentDialog
              organizationId={organizationId}
              resident={resident}
              dueRecord={null}
              defaultAmount={advanceLeft}
              mode="advance"
              disabled={!organizationId || advanceLeft <= 0}
              onSaved={onSaved}
            />
            {whatsappUrl ? (
              <Button asChild size="sm">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  WhatsApp reminder
                </a>
              </Button>
            ) : (
              <Button size="sm" disabled>
                <MessageCircle className="size-3.5" aria-hidden="true" />
                No WhatsApp number
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => void copyReminder()}>
              Copy message
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-background/70 p-3">
          <h4 className="text-sm font-semibold">Monthly dues</h4>
          <div className="mt-3 grid gap-2">
            {ledger.feeRecords.slice(0, 5).map((record) => (
              <div key={record.id} className="rounded-lg border bg-white/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{formatPeriodMonth(record.period_month)}</span>
                  <StatusBadge status={record.status} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>Paid {formatCurrency(record.paid_amount)}</span>
                  <span>Left {formatCurrency(record.balance_amount)}</span>
                  <span>Due {formatDate(record.due_date)}</span>
                </div>
              </div>
            ))}
            {ledger.feeRecords.length === 0 ? (
              <p className="rounded-lg border bg-muted/35 p-3 text-sm text-muted-foreground">
                No monthly dues generated yet. Record cash can create the current month due automatically.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-background/70 p-3">
          <h4 className="text-sm font-semibold">Money transactions</h4>
          <div className="mt-3 grid gap-2">
            {ledger.payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="rounded-lg border bg-white/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  <StatusBadge status={payment.status} />
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {payment.transaction_id ?? payment.manual_reference ?? payment.id.slice(0, 8)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(payment.created_at)}
                </p>
              </div>
            ))}
            {ledger.payments.length === 0 ? (
              <p className="rounded-lg border bg-muted/35 p-3 text-sm text-muted-foreground">
                No payment transactions submitted yet.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function RecordInPersonPaymentDialog({
  organizationId,
  resident,
  dueRecord,
  defaultAmount,
  mode,
  periodMonth,
  dueDate,
  disabled,
  onSaved,
}: {
  organizationId?: string | null
  resident: Tables<"residents">
  dueRecord: Tables<"monthly_fee_records"> | null
  defaultAmount: number
  mode: "due" | "advance"
  periodMonth?: string
  dueDate?: string
  disabled: boolean
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(() =>
    defaultAmount > 0 ? String(defaultAmount) : ""
  )
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash")
  const [manualReference, setManualReference] = useState("")
  const [notes, setNotes] = useState("")
  const recordPayment = useRecordInPersonPayment()
  const generateMonthlyFee = useGenerateMonthlyFee()
  const isAdvance = mode === "advance"
  const title = isAdvance ? "Record advance" : "Record cash payment"
  const payableLabel = isAdvance
    ? "One-month advance balance"
    : dueRecord
      ? `${formatPeriodMonth(dueRecord.period_month)} due balance`
      : "Current month due"

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!organizationId) {
      toast.error("Tenant context is still loading.")
      return
    }

    if (!isAdvance && (!periodMonth || !dueDate)) {
      toast.error("Monthly due period is missing. Refresh and try again.")
      return
    }

    const parsedAmount = Number(amount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid payment amount.")
      return
    }

    try {
      let targetDueRecord = dueRecord

      if (!isAdvance && !targetDueRecord) {
        targetDueRecord = await generateMonthlyFee.mutateAsync({
          organizationId,
          hostelId: resident.hostel_id,
          residentId: resident.id,
          periodMonth: periodMonth as string,
          dueDate: dueDate as string,
          baseAmount: resident.monthly_fee_amount,
          discountAmount: 0,
          penaltyAmount: 0,
          adjustmentAmount: 0,
          advanceAdjustmentAmount: 0,
          notes: "Generated from resident cash collection.",
        })
      }

      await recordPayment.mutateAsync({
        organizationId,
        hostelId: resident.hostel_id,
        residentId: resident.id,
        monthlyFeeRecordId: isAdvance ? undefined : targetDueRecord?.id,
        amount: parsedAmount,
        method,
        manualReference: manualReference.trim() || undefined,
        notes: notes.trim() || undefined,
        isAdvance,
        isPartial: !isAdvance && targetDueRecord ? parsedAmount < targetDueRecord.balance_amount : false,
        idempotencyKey: `admin-manual-${crypto.randomUUID()}`,
      })

      toast.success(
        isAdvance
          ? "Advance payment recorded and visible to the resident."
          : "Cash payment recorded and due balance updated."
      )
      setOpen(false)
      onSaved()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to record in-person payment."
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant={isAdvance ? "outline" : "default"}
        disabled={disabled}
        onClick={() => {
          setAmount(defaultAmount > 0 ? String(defaultAmount) : "")
          setOpen(true)
        }}
      >
        <Banknote className="size-3.5" aria-hidden="true" />
        {isAdvance ? "Record advance" : "Record cash"}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Save money received at the desk. The resident ledger updates after admin verification.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="rounded-xl border bg-muted/35 p-3">
            <p className="text-xs text-muted-foreground">{payableLabel}</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(defaultAmount)}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${mode}-manual-payment-amount`}>Amount received</Label>
            <Input
              id={`${mode}-manual-payment-amount`}
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="3500"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${mode}-manual-payment-method`}>Payment method</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as "cash" | "bank_transfer")}
            >
              <SelectTrigger id={`${mode}-manual-payment-method`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${mode}-manual-payment-reference`}>Receipt or reference</Label>
            <Input
              id={`${mode}-manual-payment-reference`}
              value={manualReference}
              onChange={(event) => setManualReference(event.target.value)}
              placeholder="Optional receipt number"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${mode}-manual-payment-notes`}>Notes</Label>
            <Textarea
              id={`${mode}-manual-payment-notes`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional internal note"
              className="min-h-24"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={recordPayment.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={recordPayment.isPending || generateMonthlyFee.isPending}>
              {recordPayment.isPending || generateMonthlyFee.isPending
                ? "Recording..."
                : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecordInitialCollectionDialog({
  organizationId,
  resident,
  dueRecord,
  dueAmount,
  advanceAmount,
  onSaved,
}: {
  organizationId?: string | null
  resident: Tables<"residents">
  dueRecord: Tables<"monthly_fee_records">
  dueAmount: number
  advanceAmount: number
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash")
  const [manualReference, setManualReference] = useState("")
  const [notes, setNotes] = useState("")
  const recordPayment = useRecordInPersonPayment()
  const totalAmount = dueAmount + advanceAmount

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!organizationId) {
      toast.error("Tenant context is still loading.")
      return
    }

    try {
      await recordPayment.mutateAsync({
        organizationId,
        hostelId: resident.hostel_id,
        residentId: resident.id,
        monthlyFeeRecordId: dueRecord.id,
        amount: dueAmount,
        method,
        manualReference: manualReference.trim() || undefined,
        notes: notes.trim() || "First month fee collected with admission advance.",
        isAdvance: false,
        isPartial: dueAmount < dueRecord.balance_amount,
        idempotencyKey: `admin-first-month-${crypto.randomUUID()}`,
      })
      await recordPayment.mutateAsync({
        organizationId,
        hostelId: resident.hostel_id,
        residentId: resident.id,
        amount: advanceAmount,
        method,
        manualReference: manualReference.trim() || undefined,
        notes: notes.trim() || "One-month advance collected with first month fee.",
        isAdvance: true,
        isPartial: false,
        idempotencyKey: `admin-first-advance-${crypto.randomUUID()}`,
      })

      toast.success("First month fee and advance recorded separately.")
      setOpen(false)
      onSaved()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to record first collection."
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <WalletCards className="size-3.5" aria-hidden="true" />
        Record first fee + advance
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record first collection</DialogTitle>
          <DialogDescription>
            Split the cash into first month fee and one-month advance so the ledger stays clear.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-3 rounded-xl border bg-muted/35 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>First month fee</span>
              <strong>{formatCurrency(dueAmount)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>One-month advance</span>
              <strong>{formatCurrency(advanceAmount)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <span>Total received</span>
              <strong>{formatCurrency(totalAmount)}</strong>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="initial-collection-method">Payment method</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as "cash" | "bank_transfer")}
            >
              <SelectTrigger id="initial-collection-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="initial-collection-reference">Reference</Label>
            <Input
              id="initial-collection-reference"
              value={manualReference}
              onChange={(event) => setManualReference(event.target.value)}
              placeholder="Receipt or transfer reference"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="initial-collection-notes">Notes</Label>
            <Textarea
              id="initial-collection-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending ? "Recording..." : "Record split payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResidentInfoLine({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate text-sm text-muted-foreground">{value}</span>
    </div>
  )
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white/55 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground capitalize">{value}</p>
    </div>
  )
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone: "success" | "warning" | "danger" | "info" | "neutral"
}) {
  const toneClassName = {
    success: "bg-success-surface text-success-foreground ring-success/20",
    warning: "bg-warning-surface text-warning-foreground ring-warning/25",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
    info: "bg-info-surface text-info-foreground ring-info/20",
    neutral: "bg-muted text-muted-foreground ring-border",
  }[tone]

  return (
    <motion.article variants={reveal}>
      <div className="group rounded-xl border bg-card/90 p-4 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
          </div>
          <span className={`flex size-10 items-center justify-center rounded-xl ring-1 ${toneClassName}`}>
            <Icon className="size-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          </span>
        </div>
      </div>
    </motion.article>
  )
}

type ResidentFinanceSnapshot = {
  currentPeriod: string
  currentRecord: Tables<"monthly_fee_records"> | null
  currentPayments: Tables<"payments">[]
  dueDate: string
  paidThisMonth: number
  pendingThisMonth: number
  pendingVerification: number
  advancePaid: number
  advanceLeft: number
  dueLeft: number
  reminderAmount: number
  status: "paid" | "partial" | "pending" | "overdue"
}

function getResidentFinanceSnapshot(
  resident: Tables<"residents">,
  ledger: ResidentPaymentLedger
): ResidentFinanceSnapshot {
  const currentPeriod = currentPeriodMonth()
  const currentRecord =
    ledger.feeRecords.find((record) => record.period_month === currentPeriod) ??
    ledger.primaryDueRecord
  const currentPayments = ledger.payments.filter((payment) =>
    currentRecord
      ? payment.monthly_fee_record_id === currentRecord.id
      : isSameMonth(payment.created_at, new Date())
  )
  const paidThisMonth = currentPayments
    .filter((payment) => payment.status === "verified" && !payment.is_advance)
    .reduce((total, payment) => total + payment.amount, 0)
  const pendingThisMonth = currentPayments
    .filter(
      (payment) =>
        !payment.is_advance &&
        (payment.status === "pending" || payment.status === "initiated")
    )
    .reduce((total, payment) => total + payment.amount, 0)
  const advanceAppliedToCurrentRecord = currentRecord
    ? currentPayments.some((payment) => payment.status === "verified" && payment.is_advance)
    : false
  const thisMonthLeft =
    currentRecord && !advanceAppliedToCurrentRecord
      ? currentRecord.balance_amount
      : Math.max(
          (currentRecord?.total_amount ?? resident.monthly_fee_amount) -
            paidThisMonth -
            pendingThisMonth,
          0
        )
  const advancePaid = ledger.totals.advanceBalance
  const advanceLeft = Math.max(resident.monthly_fee_amount - advancePaid, 0)
  const dueLeft = currentRecord ? Math.max(ledger.totals.currentDue, thisMonthLeft) : thisMonthLeft
  const reminderAmount = dueLeft + advanceLeft
  const status =
    ledger.totals.overdue > 0 || currentRecord?.status === "overdue"
      ? "overdue"
      : reminderAmount <= 0
        ? "paid"
        : paidThisMonth > 0 || pendingThisMonth > 0 || currentRecord?.status === "partial"
          ? "partial"
          : "pending"

  return {
    currentPeriod,
    currentRecord,
    currentPayments,
    dueDate: currentRecord?.due_date ?? buildMonthlyDueDate(currentPeriod),
    paidThisMonth,
    pendingThisMonth,
    pendingVerification: ledger.totals.pendingVerification,
    advancePaid,
    advanceLeft,
    dueLeft,
    reminderAmount,
    status,
  }
}

function buildAdminPaymentReminderMessage(input: {
  resident: Tables<"residents">
  periodMonth: string
  dueDate: string
  monthlyFee: number
  paidThisMonth: number
  pendingThisMonth: number
  dueLeft: number
  advanceLeft: number
}) {
  return [
    `Hello ${input.resident.full_name}, this is a Sadhana Boys Hostel fee reminder.`,
    `Admission: ${input.resident.admission_number}`,
    `Month: ${formatPeriodMonth(input.periodMonth)}`,
    `Last date: ${formatDate(input.dueDate)}`,
    `Monthly fee: ${formatCurrency(input.monthlyFee)}`,
    `Paid this month: ${formatCurrency(input.paidThisMonth)}`,
    input.pendingThisMonth > 0
      ? `Pending admin verification: ${formatCurrency(input.pendingThisMonth)}`
      : null,
    `Due left: ${formatCurrency(input.dueLeft)}`,
    input.advanceLeft > 0
      ? `One-month advance balance required: ${formatCurrency(input.advanceLeft)}`
      : `One-month advance requirement: complete`,
    "Please complete the pending payment and upload the payment screenshot in the resident portal. UPI reference is optional.",
  ]
    .filter(Boolean)
    .join("\n")
}

function buildResidentReminderUrl(
  resident: Tables<"residents">,
  snapshot: ResidentFinanceSnapshot
) {
  if (snapshot.reminderAmount <= 0) {
    return null
  }

  return buildWhatsappUrl({
    phone: resident.phone,
    message: buildAdminPaymentReminderMessage({
      resident,
      periodMonth: snapshot.currentRecord?.period_month ?? snapshot.currentPeriod,
      dueDate: snapshot.dueDate,
      monthlyFee: resident.monthly_fee_amount,
      paidThisMonth: snapshot.paidThisMonth,
      pendingThisMonth: snapshot.pendingThisMonth,
      dueLeft: snapshot.dueLeft,
      advanceLeft: snapshot.advanceLeft,
    }),
  })
}

function currentPeriodMonth() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

function buildMonthlyDueDate(periodMonth: string) {
  return `${periodMonth.slice(0, 7)}-10`
}

function formatPeriodMonth(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(date)
}

function isSameMonth(value: string, comparison: Date) {
  const date = new Date(value)

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === comparison.getFullYear() &&
    date.getMonth() === comparison.getMonth()
  )
}
