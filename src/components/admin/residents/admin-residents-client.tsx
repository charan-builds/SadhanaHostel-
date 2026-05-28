"use client"

import Link from "next/link"
import type { Route } from "next"
import { Edit, Eye, KeyRound, LogOut, Plus, Search, UserX, Wrench } from "lucide-react"
import { useMemo, useState } from "react"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDate } from "@/lib/format"
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

type ResidentStatusFilter = "all" | "draft" | "active" | "suspended" | "checked_out" | "archived"
type ResidentTypeFilter = "all" | "student" | "employee" | "other"

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

  const summary = useMemo(() => {
    const rows = query.data?.data ?? []
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
  }, [analytics.data, query.data])

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
      reason: "Resident checked out from admin residents table.",
    })
    toast.success("Resident checked out and occupancy released.")
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
        title="Organization access required"
        message="Your admin account needs an organization assignment before residents can load."
      />
    )
  }

  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Residents"
        description="Manage resident profiles, onboarding details, fees, and account status."
        actions={
          <Button asChild>
            <Link href={"/admin/residents/new" as Route}>
              <Plus className="size-4" aria-hidden="true" />
              Add Resident
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Registered Residents" value={summary.registered} />
        <SummaryCard label="Active Residents" value={summary.active} />
        <SummaryCard label="Draft / Onboarding" value={summary.onboarding} />
        <SummaryCard label="Verified Residents" value={summary.verified} />
        <SummaryCard label="Pending Verification" value={summary.pendingVerification} />
        <SummaryCard label="Suspended Residents" value={summary.suspended} />
        <SummaryCard label="Checked-out Residents" value={summary.checkedOut} />
        <SummaryCard label="Monthly Fees on This Page" value={formatCurrency(summary.monthlyFees)} />
      </section>

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
          query.data?.data.length === 0 ? (
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
        <div className="grid gap-3 border-b p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
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
              <SelectItem value="checked_out">Checked out</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isLoading ? (
          <LoadingState variant="table" />
        ) : (
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
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data?.data.map((resident) => (
                <TableRow key={resident.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{resident.full_name}</p>
                      <p className="text-xs text-muted-foreground">{resident.email ?? resident.id}</p>
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
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/residents/${resident.id}` as Route}>
                          <Eye className="size-3.5" aria-hidden="true" />
                          View
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingResident(resident)}>
                        <Edit className="size-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(resident.user_id)}
                        onClick={() => setInviteTarget(resident)}
                      >
                        <KeyRound className="size-3.5" aria-hidden="true" />
                        Invite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={repairResidentLifecycle.isPending}
                        onClick={() => setRepairTarget(resident)}
                      >
                        <Wrench className="size-3.5" aria-hidden="true" />
                        Repair
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resident.status === "checked_out" || resident.status === "archived"}
                        onClick={() => setCheckoutTarget(resident)}
                      >
                        <LogOut className="size-3.5" aria-hidden="true" />
                        Checkout
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeactivateTarget(resident)}>
                        <UserX className="size-3.5" aria-hidden="true" />
                        Deactivate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        title={`Check out ${checkoutTarget?.full_name ?? "resident"}?`}
        description="Checkout releases the active room allocation, updates vacancy, and keeps the resident record visible for operational history."
        confirmLabel={checkoutResident.isPending ? "Checking out..." : "Check out"}
        onConfirm={() => void confirmCheckout()}
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={`Deactivate ${deactivateTarget?.full_name ?? "resident"}?`}
        description="The resident will be archived through the production API. Financial records remain immutable."
        confirmLabel={deactivateResident.isPending ? "Deactivating..." : "Deactivate"}
        variant="danger"
        onConfirm={() => void confirmDeactivate()}
      />

      <ConfirmDialog
        open={Boolean(repairTarget)}
        onOpenChange={(open) => !open && setRepairTarget(null)}
        title={`Repair lifecycle for ${repairTarget?.full_name ?? "resident"}?`}
        description="This safely checks auth linkage, duplicate invites, stale onboarding, active allocations, invalid dues, and occupancy snapshots for this resident. All changes are tenant-scoped and audit logged."
        confirmLabel={repairResidentLifecycle.isPending ? "Repairing..." : "Repair lifecycle"}
        onConfirm={() => void confirmRepair()}
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

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
