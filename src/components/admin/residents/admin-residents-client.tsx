"use client"

import Link from "next/link"
import type { Route } from "next"
import {
  CalendarDays,
  Edit,
  Eye,
  IdCard,
  KeyRound,
  LogOut,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  UserX,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import {
  formatResidentIdentityMode,
  getResidentIdentityMode,
} from "@/lib/resident-identity"
import { useRealtimeAdmissions } from "@/lib/realtime"
import {
  useCheckoutResident,
  useDashboardAnalytics,
  useDeleteResident,
  useRepairResidentLifecycle,
  useResidents,
} from "@/hooks"
import type { Tables } from "@/types/database"

type ResidentStatusFilter =
  | "all"
  | "draft"
  | "pending_finance"
  | "active"
  | "suspended"
  | "checked_out"
  | "archived"
type ResidentStatusTab = "active" | "draft" | "verified" | "checked_out" | "all"
type ResidentTypeFilter = "all" | "student" | "employee" | "other"

const residentStatusTabs: Array<{ value: ResidentStatusTab; label: string }> = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "verified", label: "Verified" },
  { value: "checked_out", label: "Left" },
  { value: "all", label: "All" },
]

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
  const [statusTab, setStatusTab] = useState<ResidentStatusTab>("all")
  const [status, setStatus] = useState<ResidentStatusFilter>("all")
  const [residentType, setResidentType] = useState<ResidentTypeFilter>("all")
  const [page, setPage] = useState(1)
  const [editingResident, setEditingResident] = useState<Tables<"residents"> | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Tables<"residents"> | null>(null)
  const [checkoutTarget, setCheckoutTarget] = useState<Tables<"residents"> | null>(null)
  const [inviteTarget, setInviteTarget] = useState<Tables<"residents"> | null>(null)
  const [repairTarget, setRepairTarget] = useState<Tables<"residents"> | null>(null)
  const [profileTarget, setProfileTarget] = useState<Tables<"residents"> | null>(null)
  const deleteResident = useDeleteResident()
  const checkoutResident = useCheckoutResident()
  const repairResidentLifecycle = useRepairResidentLifecycle()
  const analytics = useDashboardAnalytics({
    organizationId: organizationId ?? "",
    hostelId,
  })
  const tabStatus =
    statusTab === "active" || statusTab === "draft" || statusTab === "checked_out"
      ? statusTab
      : undefined
  const tabOnboardingStatus = statusTab === "verified" ? "verified" : undefined
  const resolvedStatus = status === "all" ? tabStatus : status
  const query = useResidents({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: 20,
    search: search || undefined,
    status: resolvedStatus,
    onboardingStatus: tabOnboardingStatus,
    residentType: residentType === "all" ? undefined : residentType,
  })
  const residentRows = useMemo(() => query.data?.data ?? [], [query.data?.data])

  const summary = useMemo(() => {
    const rows = residentRows
    const lifecycle = analytics.data?.residentLifecycle

    return {
      registered: analytics.data?.totalResidents ?? query.data?.meta.total ?? 0,
      active: lifecycle?.activeResidents ?? rows.filter((resident) => resident.status === "active").length,
      onboarding:
        lifecycle?.onboardingResidents ??
        rows.filter((resident) =>
          ["draft", "pending_finance"].includes(resident.status)
        ).length,
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
    }
  }, [analytics.data, query.data?.meta.total, residentRows])

  async function confirmDeactivate() {
    if (!organizationId || !deactivateTarget) {
      return
    }

    await deleteResident.mutateAsync({
      residentId: deactivateTarget.id,
      organizationId,
    })
    toast.success("Resident and linked financial records deleted.")
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
        description="Manage resident profiles, admission details, contacts, documents, and lifecycle status."
        actions={
          <div className="flex flex-wrap gap-2">
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
        <SummaryCard label="Draft Residents" value={summary.onboarding} icon={KeyRound} tone="warning" />
        <SummaryCard label="Verified Residents" value={summary.verified} icon={IdCard} tone="success" />
        <SummaryCard label="Resident Follow-up" value={summary.pendingVerification} icon={Wrench} tone="warning" />
        <SummaryCard label="Suspended Residents" value={summary.suspended} icon={UserX} tone="danger" />
        <SummaryCard label="Left Residents" value={summary.checkedOut} icon={LogOut} tone="neutral" />
      </motion.section>

      {query.error ? (
        <APIErrorState
          title="Residents failed to load"
          message="Check filters or retry the request."
          onRetry={() => void query.refetch()}
        />
      ) : null}

      <DataTableShell
        title="Resident Records"
        description="Server-side search, filters, pagination, and production API actions."
        empty={
          residentRows.length === 0 ? (
            <EmptyState
              title={
                search ||
                statusTab !== "all" ||
                status !== "all" ||
                residentType !== "all"
                  ? "No residents match these filters"
                  : "No residents yet"
              }
              message={
                search ||
                statusTab !== "all" ||
                status !== "all" ||
                residentType !== "all"
                  ? "Clear filters to return to the full resident list."
                  : "Create your first resident after admission approval, then send an activation invite."
              }
              action={
                search ||
                statusTab !== "all" ||
                status !== "all" ||
                residentType !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("")
                      setStatusTab("all")
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
        <div className="border-b bg-white/45 p-4">
          <div
            className="flex min-w-0 gap-2 overflow-x-auto pb-3"
            aria-label="Resident lifecycle tabs"
          >
            {residentStatusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={statusTab === tab.value}
                onClick={() => {
                  setPage(1)
                  setStatus("all")
                  setStatusTab(tab.value)
                }}
                className={
                  statusTab === tab.value
                    ? "whitespace-nowrap rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm"
                    : "whitespace-nowrap rounded-lg border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <motion.div
            layout
            className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center"
          >
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
            <Select
              value={residentType}
              onValueChange={(value) => {
                setPage(1)
                setResidentType(value as ResidentTypeFilter)
              }}
            >
              <SelectTrigger
                className="h-9 min-w-40"
                aria-label="Filter resident type"
              >
                <SelectValue placeholder="Resident type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1)
                setStatusTab("all")
                setStatus(value as ResidentStatusFilter)
              }}
            >
              <SelectTrigger
                className="h-9 min-w-40"
                aria-label="Filter resident status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_finance">Pending finance</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="checked_out">Left hostel</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>
        </div>

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
              {residentRows.slice(0, 6).map((resident, index) => (
                <ResidentProfileTile
                  key={resident.id}
                  resident={resident}
                  serialNumber={residentSerial(resident, (page - 1) * 20 + index + 1)}
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
                    <TableHead>Serial</TableHead>
                    <TableHead>Admission</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Portal Access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {residentRows.map((resident, index) => (
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
                      <TableCell>
                        {formatResidentSerial(
                          residentSerial(resident, (page - 1) * 20 + index + 1)
                        )}
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
        serialNumber={
          profileTarget
            ? residentSerial(
                profileTarget,
                (page - 1) * 20 +
                  Math.max(0, residentRows.findIndex((row) => row.id === profileTarget.id)) +
                  1
              )
            : null
        }
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
        title={`Delete ${deactivateTarget?.full_name ?? "resident"}?`}
        description="This deletes the resident from operations together with payments, invoices, fee records, advance ledger, and linked financial records. Revenue and reports will recalculate automatically."
        confirmLabel={deleteResident.isPending ? "Deleting..." : "Delete Resident"}
        variant="danger"
        onConfirm={confirmDeactivate}
      />

      <ConfirmDialog
        open={Boolean(repairTarget)}
        onOpenChange={(open) => !open && setRepairTarget(null)}
        title={`Repair lifecycle for ${repairTarget?.full_name ?? "resident"}?`}
        description="This safely checks auth linkage, duplicate invites, stale access state, active allocations, invalid dues, and occupancy snapshots for this resident. All changes are tenant-scoped and audit logged."
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
  serialNumber,
  onPreview,
  onEdit,
  onInvite,
  onRepair,
  onCheckout,
  onDeactivate,
  repairDisabled,
}: {
  resident: Tables<"residents">
  serialNumber: number
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
                {formatResidentSerial(serialNumber)} · {resident.admission_number}
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
          Delete Resident
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ResidentProfileSheet({
  resident,
  serialNumber,
  open,
  onOpenChange,
  onEdit,
  onInvite,
}: {
  resident: Tables<"residents"> | null
  serialNumber: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onInvite: () => void
}) {
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
                <ProfileMetric
                  label="Resident Serial"
                  value={formatResidentSerial(serialNumber ?? 0)}
                />
                <ProfileMetric label="Joined" value={formatDate(resident.joined_on ?? resident.created_at)} />
                <ProfileMetric label="Identity mode" value={formatResidentIdentityMode(getResidentIdentityMode(resident))} />
                <ProfileMetric label="Resident type" value={resident.resident_type} />
              </div>

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

function residentSerial(resident: Tables<"residents">, fallback: number) {
  const metadata =
    resident.metadata && typeof resident.metadata === "object" && !Array.isArray(resident.metadata)
      ? resident.metadata as Record<string, unknown>
      : {}
  const value = Number(metadata.resident_serial)

  return Number.isInteger(value) && value > 0 ? value : fallback
}

function formatResidentSerial(value: number) {
  return `R${String(Math.max(0, value)).padStart(4, "0")}`
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
