"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
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
import { useCreateLead, useLeads, useUpdateLead } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDate, humanizeEnum } from "@/lib/format"
import { useRealtimeAdmissions } from "@/lib/realtime"
import type { LeadRow, LeadStatus } from "@/types/admissions"

const PAGE_SIZE = 12
const leadStatuses: Array<LeadStatus | "all"> = [
  "all",
  "new_inquiry",
  "called",
  "interested",
  "reserved",
  "confirmed",
  "cancelled",
  "joined",
]

export function AdminLeadsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<LeadStatus | "all">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null)
  const leads = useLeads({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  })
  const rows = leads.data?.data ?? []
  const meta = leads.data?.meta
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })

  if (!organizationId) {
    return <EmptyState title="Organization access required" message="Lead management needs an assigned organization." />
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">Admissions</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Leads
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Track website, WhatsApp, phone, and walk-in inquiries through follow-up and booking.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditingLead(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add lead
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inquiry Pipeline</CardTitle>
          <CardDescription>Admin-owned leads remain tenant-scoped and auditable.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="pl-9"
                placeholder="Search name, phone, WhatsApp, email"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as LeadStatus | "all")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leadStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "all" ? "All statuses" : humanizeEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {leads.isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 rounded-lg border bg-muted/50" />
              ))}
            </div>
          ) : leads.isError ? (
            <APIErrorState
              title="Leads failed to load"
              error={leads.error}
              onRetry={() => void leads.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No leads found"
              message="New public website inquiries and manual inquiries will appear here."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Joining</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="font-medium">{lead.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.phone}
                          {lead.whatsapp_number ? ` · WA ${lead.whatsapp_number}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>{humanizeEnum(lead.resident_type)}</TableCell>
                      <TableCell>{formatDate(lead.desired_joining_date)}</TableCell>
                      <TableCell>{humanizeEnum(lead.source)}</TableCell>
                      <TableCell>
                        <StatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingLead(lead)
                            setDialogOpen(true)
                          }}
                        >
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {rows.length} of {meta?.total ?? 0} leads
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!meta || page <= 1 || leads.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!meta || page >= meta.totalPages || leads.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editingLead}
        organizationId={organizationId}
        hostelId={hostelId}
      />
    </div>
  )
}

function LeadDialog({
  open,
  onOpenChange,
  lead,
  organizationId,
  hostelId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadRow | null
  organizationId: string
  hostelId?: string
}) {
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const pending = createLead.isPending || updateLead.isPending

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const values = {
      organizationId,
      hostelId,
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      whatsappNumber: String(formData.get("whatsappNumber") ?? "") || undefined,
      email: String(formData.get("email") ?? "") || undefined,
      residentType: String(formData.get("residentType") ?? "student") as "student",
      desiredJoiningDate: String(formData.get("desiredJoiningDate") ?? "") || undefined,
      expectedStayDuration: String(formData.get("expectedStayDuration") ?? "") || undefined,
      parentName: String(formData.get("parentName") ?? "") || undefined,
      parentPhone: String(formData.get("parentPhone") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      source: String(formData.get("source") ?? "phone") as "phone",
      status: String(formData.get("status") ?? "new_inquiry") as LeadStatus,
    }

    if (lead) {
      await updateLead.mutateAsync({
        ...values,
        leadId: lead.id,
      })
      toast.success("Lead updated.")
    } else {
      await createLead.mutateAsync(values)
      toast.success("Lead created.")
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{lead ? "Update Lead" : "Create Lead"}</DialogTitle>
            <DialogDescription>
              Capture inquiry details before creating a reservation.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input name="fullName" defaultValue={lead?.full_name ?? ""} required />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" defaultValue={lead?.phone ?? ""} required />
            </Field>
            <Field label="WhatsApp">
              <Input name="whatsappNumber" type="tel" defaultValue={lead?.whatsapp_number ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={lead?.email ?? ""} />
            </Field>
            <Field label="Resident type">
              <Select name="residentType" defaultValue={lead?.resident_type ?? "student"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Desired joining">
              <Input
                name="desiredJoiningDate"
                type="date"
                defaultValue={lead?.desired_joining_date ?? ""}
              />
            </Field>
            <Field label="Expected stay">
              <Input name="expectedStayDuration" defaultValue={lead?.expected_stay_duration ?? ""} />
            </Field>
            <Field label="Source">
              <Select name="source" defaultValue={lead?.source ?? "phone"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["phone", "whatsapp", "website", "walk_in", "referral", "other"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {humanizeEnum(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={lead?.status ?? "new_inquiry"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leadStatuses.filter((item) => item !== "all").map((item) => (
                    <SelectItem key={item} value={item}>
                      {humanizeEnum(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Parent name">
              <Input name="parentName" defaultValue={lead?.parent_name ?? ""} />
            </Field>
            <Field label="Parent phone">
              <Input name="parentPhone" type="tel" defaultValue={lead?.parent_phone ?? ""} />
            </Field>
            <div className="grid gap-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea name="notes" rows={4} defaultValue={lead?.notes ?? ""} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {lead ? "Save lead" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
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
