"use client"

import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Copy, KeyRound, Loader2, Plus, Search, ShieldCheck, UserX } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState, EmptyState } from "@/components/system"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAuth } from "@/lib/auth"
import { humanizeEnum } from "@/lib/format"
import { useRealtimeStaffAccess } from "@/lib/realtime"
import {
  useCreateStaffAccess,
  useHostels,
  useResetStaffPassword,
  useRevokeStaffAccess,
  useStaffAccess,
  useUpdateStaffAccess,
} from "@/hooks"
import type { CreatedStaffAccess, StaffAccessAccount, StaffPasswordResetResult } from "@/sdk/staff-access.sdk"
import type { CreateStaffUserInput } from "@/validations/staff-access.validation"

const staffRoles = ["owner", "admin", "finance", "receptionist", "warden", "staff"] as const
const accountStatuses = ["invited", "active", "suspended", "locked", "deleted"] as const

type RoleFilter = "all" | (typeof staffRoles)[number]
type StatusFilter = "all" | (typeof accountStatuses)[number]

export function AdminStaffAccessClient() {
  const { organizationId, session } = useAuth()
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<RoleFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [createRole, setCreateRole] = useState<CreateStaffUserInput["role"]>("staff")
  const [accessResult, setAccessResult] = useState<CreatedStaffAccess | null>(null)
  const [passwordResult, setPasswordResult] = useState<StaffPasswordResetResult | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<StaffAccessAccount | null>(null)
  const hostelId = session?.hostelIds[0]
  const roles = session?.roles ?? []
  const canManageOwners = roles.includes("owner") || roles.includes("super_admin")

  const staffQuery = useStaffAccess({
    organizationId: organizationId ?? "",
    hostelId: undefined,
    page: 1,
    pageSize: 50,
    search: search || undefined,
    role: role === "all" ? undefined : role,
    status: status === "all" ? undefined : status,
  })
  const hostelsQuery = useHostels(Boolean(organizationId))
  const updateStaff = useUpdateStaffAccess()
  const revokeStaff = useRevokeStaffAccess()
  const resetPassword = useResetStaffPassword()

  useRealtimeStaffAccess({ enabled: Boolean(organizationId) })

  const rows = useMemo(() => staffQuery.data?.data ?? [], [staffQuery.data?.data])
  const summary = useMemo(
    () => ({
      total: staffQuery.data?.meta.total ?? 0,
      active: rows.filter((row) => row.accountState === "active").length,
      invited: rows.filter((row) => row.accountState === "invited").length,
      privileged: rows.filter((row) => row.role === "owner" || row.role === "admin").length,
    }),
    [rows, staffQuery.data?.meta.total]
  )

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  async function updateStatus(row: StaffAccessAccount, nextStatus: StatusFilter) {
    if (!organizationId || nextStatus === "all") {
      return
    }

    try {
      await updateStaff.mutateAsync({
        organizationId,
        targetUserId: row.user_id,
        roleAssignmentId: row.id,
        status: nextStatus,
      })
      toast.success("Staff access updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update staff access.")
    }
  }

  async function confirmRevoke() {
    if (!organizationId || !revokeTarget) {
      return
    }

    await revokeStaff.mutateAsync({
      organizationId,
      targetUserId: revokeTarget.user_id,
    })
    setRevokeTarget(null)
    toast.success("Staff access revoked.")
  }

  async function handleResetPassword(row: StaffAccessAccount) {
    if (!organizationId) {
      return
    }

    try {
      const result = await resetPassword.mutateAsync({
        organizationId,
        targetUserId: row.user_id,
      })
      setPasswordResult(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset staff password.")
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Team accounts" value={summary.total} />
        <MetricCard label="Active" value={summary.active} />
        <MetricCard label="Invited" value={summary.invited} />
        <MetricCard label="Owners/Admins" value={summary.privileged} />
      </div>

      <Card>
        <CardHeader className="gap-3 md:grid md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Staff & Access</CardTitle>
            <CardDescription>
              Create, suspend, reset, and revoke operational staff without opening Supabase.
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {canManageOwners ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setCreateRole("admin")
                    setCreateOpen(true)
                  }}
                >
                  <ShieldCheck className="size-4" />
                  Add admin
                </Button>
              ) : null}
              <DialogTrigger asChild>
                <Button
                  className="gap-2"
                  onClick={() => setCreateRole("staff")}
                >
                  <Plus className="size-4" />
                  Add staff
                </Button>
              </DialogTrigger>
            </div>
            <StaffCreateDialog
              key={`${organizationId}-${createRole}`}
              organizationId={organizationId}
              defaultHostelId={hostelId}
              hostels={hostelsQuery.data ?? []}
              canManageOwners={canManageOwners}
              initialRole={createRole}
              onCreated={(result) => {
                setAccessResult(result)
                setCreateOpen(false)
              }}
            />
          </Dialog>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <label className="relative">
              <span className="sr-only">Search staff</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
                placeholder="Search name, email, phone, role"
              />
            </label>
            <Select value={role} onValueChange={(value) => setRole(value as RoleFilter)}>
              <SelectTrigger aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {staffRoles.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanizeEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {accountStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanizeEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {staffQuery.isError ? (
            <APIErrorState
              title="Staff access could not be loaded"
              error={staffQuery.error}
              onRetry={() => void staffQuery.refetch()}
            />
          ) : staffQuery.isLoading ? (
            <div className="h-64 rounded-lg border bg-muted/40" />
          ) : rows.length === 0 ? (
            <EmptyState
              title={search || role !== "all" || status !== "all" ? "No staff match these filters" : "No staff accounts yet"}
              message={
                search || role !== "all" || status !== "all"
                  ? "Clear filters to return to the full access list."
                  : "Invite your first finance, receptionist, warden, or admin user from here."
              }
              action={
                search || role !== "all" || status !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("")
                      setRole("all")
                      setStatus("all")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setCreateRole("staff")
                      setCreateOpen(true)
                    }}
                  >
                    Add staff
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.user.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.user.email ?? row.user.phone ?? row.user_id}
                        </div>
                      </TableCell>
                      <TableCell>{humanizeEnum(row.role)}</TableCell>
                      <TableCell>{row.hostel?.name ?? "Organization-wide"}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.accountState} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Select
                            value={row.accountState}
                            onValueChange={(value) => void updateStatus(row, value as StatusFilter)}
                          >
                            <SelectTrigger className="h-9 w-32" aria-label="Change account status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {accountStatuses.filter((item) => item !== "deleted").map((item) => (
                                <SelectItem key={item} value={item}>
                                  {humanizeEnum(item)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => void handleResetPassword(row)}
                          >
                            <KeyRound className="size-4" />
                            Reset
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setRevokeTarget(row)}
                          >
                            <UserX className="size-4" />
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AccessResultDialog result={accessResult} onClose={() => setAccessResult(null)} />
      <PasswordResultDialog result={passwordResult} onClose={() => setPasswordResult(null)} />
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={`Revoke ${revokeTarget?.user.full_name ?? "staff"}?`}
        description="This removes operational access and blocks future sessions for this app profile."
        confirmLabel={revokeStaff.isPending ? "Revoking..." : "Revoke access"}
        variant="danger"
        onConfirm={confirmRevoke}
      />
    </div>
  )
}

function StaffCreateDialog({
  organizationId,
  defaultHostelId,
  hostels,
  canManageOwners,
  initialRole,
  onCreated,
}: {
  organizationId: string
  defaultHostelId?: string
  hostels: Array<{ id: string; name: string }>
  canManageOwners: boolean
  initialRole: CreateStaffUserInput["role"]
  onCreated: (result: CreatedStaffAccess) => void
}) {
  const createStaff = useCreateStaffAccess()
  const [actionError, setActionError] = useState<unknown>(null)
  const defaultRole = canManageOwners || (initialRole !== "owner" && initialRole !== "admin")
    ? initialRole
    : "staff"
  const [form, setForm] = useState<CreateStaffUserInput>({
    organizationId,
    hostelId: defaultHostelId,
    fullName: "",
    email: "",
    phone: "",
    role: defaultRole,
    deliveryMode: "invite_link",
    permissions: [],
    expiresInHours: 72,
  })
  const availableRoles = canManageOwners
    ? staffRoles
    : staffRoles.filter((item) => item !== "owner" && item !== "admin")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setActionError(null)
      const result = await createStaff.mutateAsync(form)

      toast.success("Staff access created.")
      onCreated(result)
    } catch (error) {
      setActionError(error)
    }
  }

  function update<K extends keyof CreateStaffUserInput>(key: K, value: CreateStaffUserInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <DialogContent className="sm:max-w-2xl">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>{form.role === "admin" ? "Add Admin" : "Add Admin or Staff"}</DialogTitle>
          <DialogDescription>
            Create a Supabase Auth account, assign a scoped role, and generate safe first access.
          </DialogDescription>
        </DialogHeader>
        {actionError ? (
          <APIErrorState
            title="Staff access could not be created"
            error={actionError}
          />
        ) : null}
        <div className="grid gap-4 py-4 md:grid-cols-2">
          <Field label="Full name">
            <Input required value={form.fullName} onChange={(event) => update("fullName", event.target.value)} />
          </Field>
          <Field label="Email">
            <Input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone ?? ""} onChange={(event) => update("phone", event.target.value)} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(value) => update("role", value as CreateStaffUserInput["role"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanizeEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hostel scope">
            <Select
              value={form.hostelId ?? "org"}
              onValueChange={(value) => update("hostelId", value === "org" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org">Organization-wide</SelectItem>
                {hostels.map((hostel) => (
                  <SelectItem key={hostel.id} value={hostel.id}>
                    {hostel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="First access">
            <Select
              value={form.deliveryMode}
              onValueChange={(value) => update("deliveryMode", value as CreateStaffUserInput["deliveryMode"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invite_link">Invite link</SelectItem>
                <SelectItem value="temp_password">Temporary password</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button disabled={createStaff.isPending} className="gap-2">
            {createStaff.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Create access
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function AccessResultDialog({
  result,
  onClose,
}: {
  result: CreatedStaffAccess | null
  onClose: () => void
}) {
  const secret = result?.inviteLink ?? result?.temporaryPassword

  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Staff Access Created</DialogTitle>
          <DialogDescription>
            Share this one-time access detail with the staff member through a trusted channel.
          </DialogDescription>
        </DialogHeader>
        {secret ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm break-all">{secret}</div>
        ) : null}
        <DialogFooter>
          {secret ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void navigator.clipboard.writeText(secret)}
            >
              <Copy className="size-4" />
              Copy
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PasswordResultDialog({
  result,
  onClose,
}: {
  result: StaffPasswordResetResult | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary Password Generated</DialogTitle>
          <DialogDescription>
            Share this password securely. The staff member should reset it after login.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm break-all">
            {result.temporaryPassword}
          </div>
        ) : null}
        <DialogFooter>
          {result ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void navigator.clipboard.writeText(result.temporaryPassword)}
            >
              <Copy className="size-4" />
              Copy
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ShieldCheck className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
