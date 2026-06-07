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
import { APIErrorState, EmptyState, WorkflowStatus } from "@/components/system"
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
  useDeactivateResident,
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
type ResidentTypeFilter = "all" | "student" | "employee" | "other"
type ResidentOutcome = {
  tone: "success" | "warning" | "info" | "danger"
  title: string
  description: string
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
  const [residentOutcome, setResidentOutcome] = useState<ResidentOutcome | null>(null)
  const deactivateResident = useDeactivateResident()
  const checkoutResident = useCheckoutResident()
  const repairResidentLifecycle = useRepairResidentLifecycle()
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
  const hasActiveResidentFilters = search.trim().length > 0 || status !== "all" || residentType !== "all"

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

    const targetResident = deactivateTarget
    await deactivateResident.mutateAsync({
      residentId: targetResident.id,
      organizationId,
    })
    await query.refetch()
    setResidentOutcome({
      tone: "warning",
      title: "Resident deactivated",
      description: `${targetResident.full_name} was archived through the production API. Financial records remain available for history and reconciliation.`,
    })
    toast.success("Resident deactivated.")
    setDeactivateTarget(null)
  }

  async function confirmCheckout() {
    if (!organizationId || !checkoutTarget) {
      return
    }

    const targetResident = checkoutTarget
    await checkoutResident.mutateAsync({
      residentId: targetResident.id,
      organizationId,
      checkoutDate: new Date().toISOString().slice(0, 10),
      reason: "Resident left the hostel from admin residents table.",
    })
    await query.refetch()
    setResidentOutcome({
      tone: "success",
      title: "Checkout completed",
      description: `${targetResident.full_name} was marked as left. Active room occupancy was released and the resident stays visible for operational history.`,
    })
    toast.success("Resident marked as left and room occupancy released.")
    setCheckoutTarget(null)
  }

  async function confirmRepair() {
    if (!organizationId || !repairTarget) {
      return
    }

    const targetResident = repairTarget
    const result = await repairResidentLifecycle.mutateAsync({
      residentId: targetResident.id,
      organizationId,
      dryRun: false,
    })
    const repairCount = Object.values(result.repairs).reduce(
      (total, value) => total + (typeof value === "number" ? value : 0),
      0
    )

    await query.refetch()
    setResidentOutcome({
      tone: repairCount > 0 ? "success" : "info",
      title: repairCount > 0 ? "Lifecycle repaired" : "Lifecycle already clean",
      description:
        repairCount > 0
          ? `${targetResident.full_name} had ${repairCount} lifecycle update${repairCount === 1 ? "" : "s"} applied. Review the profile if access or occupancy still looks unusual.`
          : `${targetResident.full_name} was checked and no repair was needed.`,
    })
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

      {residentOutcome ? (
        <WorkflowStatus
          tone={residentOutcome.tone}
          title={residentOutcome.title}
          description={residentOutcome.description}
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
          <Select
            value={residentType}
            onValueChange={(value) => {
              setPage(1)
              setResidentType(value as ResidentTypeFilter)
            }}
          >
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
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1)
              setStatus(value as ResidentStatusFilter)
            }}
          >
            <SelectTrigger className="h-9 min-w-40" aria-label="Filter resident status">
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

        {hasActiveResidentFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-b bg-white/35 px-4 py-3 text-xs text-muted-foreground">
            {search.trim() ? (
              <span className="rounded-full border bg-background px-2.5 py-1">
                Search: {search.trim()}
              </span>
            ) : null}
            {residentType !== "all" ? (
              <span className="rounded-full border bg-background px-2.5 py-1">
                Type: {residentType}
              </span>
            ) : null}
            {status !== "all" ? (
              <span className="rounded-full border bg-background px-2.5 py-1">
                Status: {status}
              </span>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPage(1)
                setSearch("")
                setStatus("all")
                setResidentType("all")
              }}
            >
              Reset filters
            </Button>
          </div>
        ) : null}

        {query.isLoading ? (
          <LoadingState variant="table" />
        ) : (
          <div className="grid gap-5 p-4">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid gap-4 lg:hidden"
            >
              {residentRows.map((resident) => (
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

            <div className="hidden overflow-hidden rounded-xl border bg-white/55 lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident</TableHead>
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
        onRepair={() => {
          if (profileTarget) {
            setRepairTarget(profileTarget)
            setProfileTarget(null)
          }
        }}
        onCheckout={() => {
          if (profileTarget) {
            setCheckoutTarget(profileTarget)
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

        <div className="mt-4 flex items-center gap-2">
          <Button type="button" className="min-h-11 flex-1" onClick={onPreview}>
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={onEdit}>
            <Edit className="size-4" aria-hidden="true" />
            Edit
          </Button>
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
  onRepair,
  onCheckout,
}: {
  resident: Tables<"residents"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onInvite: () => void
  onRepair: () => void
  onCheckout: () => void
}) {
  const lifecycle = resident ? getResidentLifecycleSummary(resident) : null

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
              {lifecycle ? (
                <WorkflowStatus
                  tone={lifecycle.tone}
                  title={lifecycle.title}
                  description={lifecycle.description}
                />
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileMetric label="Joined" value={formatDate(resident.joined_on ?? resident.created_at)} />
                <ProfileMetric label="Identity mode" value={formatResidentIdentityMode(getResidentIdentityMode(resident))} />
                <ProfileMetric label="Resident type" value={resident.resident_type} />
                <ProfileMetric label="Monthly fee" value={resident.monthly_fee_amount.toLocaleString("en-IN")} />
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
                  <TimelineRow
                    label="Room action"
                    value={
                      resident.status === "checked_out" || resident.checkout_on
                        ? "Room already released"
                        : "Checkout releases active allocation"
                    }
                  />
                </div>
              </section>

              <section className="rounded-xl border bg-white/55 p-4">
                <h3 className="text-sm font-semibold text-foreground">Action readiness</h3>
                <div className="mt-4 grid gap-3">
                  <ResidentChecklistItem
                    label="Portal access"
                    complete={Boolean(resident.user_id)}
                    detail={resident.user_id ? "Resident can use the portal." : "Send an invite before expecting resident self-service."}
                  />
                  <ResidentChecklistItem
                    label="Identity document"
                    complete={Boolean(resident.aadhaar_document_id)}
                    detail={resident.aadhaar_document_id ? "Document is linked." : "Aadhaar document is still pending."}
                  />
                  <ResidentChecklistItem
                    label="Contact path"
                    complete={Boolean(resident.phone || resident.email)}
                    detail={resident.phone || resident.email ? "At least one direct contact is available." : "Add phone or email before follow-up."}
                  />
                  <ResidentChecklistItem
                    label="Parent/emergency contact"
                    complete={Boolean(resident.parent_phone || resident.emergency_contact_phone)}
                    detail={
                      resident.parent_phone || resident.emergency_contact_phone
                        ? "Family or emergency contact is present."
                        : "Add parent or emergency contact before sensitive actions."
                    }
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
                <Button variant="outline" onClick={onRepair}>
                  <Wrench className="size-4" aria-hidden="true" />
                  Repair lifecycle
                </Button>
                <Button
                  variant="outline"
                  disabled={resident.status === "checked_out" || resident.status === "archived"}
                  onClick={onCheckout}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Mark left
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function getResidentLifecycleSummary(resident: Tables<"residents">): ResidentOutcome {
  if (resident.status === "checked_out" || resident.checkout_on) {
    return {
      tone: "info",
      title: "Resident has left the hostel",
      description:
        "Keep this record for operational history. Reactivation should go through a deliberate admission or profile update flow.",
    }
  }

  if (!resident.user_id) {
    return {
      tone: "warning",
      title: "Activation is still pending",
      description:
        "The next useful action is sending an invite. Until then, the resident cannot complete self-service payments, support, or leave requests.",
    }
  }

  if (!resident.aadhaar_document_id) {
    return {
      tone: "warning",
      title: "Identity document needs follow-up",
      description:
        "Portal access is linked, but the resident profile still needs document completion before lifecycle operations feel fully reliable.",
    }
  }

  if (resident.status === "active") {
    return {
      tone: "success",
      title: "Resident is operationally active",
      description:
        "Portal access, active status, and core profile state are ready. Use repair only if finance, invite, or occupancy state looks inconsistent.",
    }
  }

  return {
    tone: "info",
    title: "Review lifecycle state",
    description:
      "Check access, documents, room status, and financial follow-up before taking an irreversible action.",
  }
}

function ResidentChecklistItem({
  label,
  complete,
  detail,
}: {
  label: string
  complete: boolean
  detail: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background/70 p-3">
      <span
        className={
          complete
            ? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-surface text-success-foreground ring-1 ring-success/20"
            : "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-warning-surface text-warning-foreground ring-1 ring-warning/25"
        }
      >
        {complete ? (
          <ShieldCheck className="size-3.5" aria-hidden="true" />
        ) : (
          <Wrench className="size-3.5" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
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
