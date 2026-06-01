"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react"
import { motion, type Variants } from "framer-motion"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { Badge } from "@/components/ui/badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCreateLead, useLeads, useUpdateLead } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDate, humanizeEnum } from "@/lib/format"
import { useRealtimeAdmissions } from "@/lib/realtime"
import { cn } from "@/lib/utils"
import type { LeadRow, LeadStatus } from "@/types/admissions"

const PAGE_SIZE = 12
const leadStatuses: Array<LeadStatus | "all"> = [
  "all",
  "new_inquiry",
  "called",
  "interested",
  "reserved",
  "confirmed",
  "waitlisted",
  "cancelled",
  "joined",
]

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const itemReveal: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

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
  const pipeline = buildLeadPipeline(rows)
  const timeline = buildLeadTimeline(rows)
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })

  if (!organizationId) {
    return <EmptyState title="Tenant context resolving" message="Sadhana Boys Hostel context is being applied automatically." />
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-6">
      <motion.div variants={itemReveal} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            <Sparkles className="size-3" aria-hidden="true" />
            Admissions CRM
          </Badge>
          <h1 className="text-gradient text-3xl font-semibold tracking-tight md:text-4xl">
            Leads Pipeline
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
      </motion.div>

      <motion.section variants={stagger} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pipeline.map((stage) => (
          <PipelineCard key={stage.status} {...stage} active={status === stage.status} />
        ))}
      </motion.section>

      <motion.section variants={itemReveal}>
        <Card className="overflow-visible">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Inquiry Workspace</CardTitle>
                <CardDescription>
                  Admin-owned leads remain tenant-scoped and auditable.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-success shadow-[0_0_12px_var(--success)]" />
                Showing {rows.length} of {meta?.total ?? 0} leads
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            <motion.div
              layout
              className="grid gap-3 rounded-xl border bg-white/55 p-3 shadow-sm backdrop-blur md:grid-cols-[1fr_auto]"
            >
              <div className="relative min-w-0">
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
            </motion.div>

            <motion.div layout className="flex gap-2 overflow-x-auto pb-1">
              {leadStatuses.map((item) => {
                const selected = status === item

                return (
                  <motion.button
                    key={item}
                    type="button"
                    layout
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setStatus(item)
                      setPage(1)
                    }}
                    className={cn(
                      "relative shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_28px_-18px_var(--primary)]"
                        : "border-border bg-white/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="lead-filter-active"
                        className="absolute inset-0 rounded-full ring-1 ring-primary/45"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="relative">
                      {item === "all" ? "All statuses" : humanizeEnum(item)}
                    </span>
                  </motion.button>
                )
              })}
            </motion.div>

          {leads.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-56 overflow-hidden rounded-xl border bg-muted/45">
                  <div className="h-full animate-pulse bg-linear-to-r from-transparent via-white/50 to-transparent" />
                </div>
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
              message={
                search || status !== "all"
                  ? "Try clearing filters or widening the search."
                  : "New public website inquiries and manual inquiries will appear here."
              }
            />
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onUpdate={() => {
                    setEditingLead(lead)
                    setDialogOpen(true)
                  }}
                />
              ))}
            </motion.div>
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
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!meta || page >= meta.totalPages || leads.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
        </Card>
      </motion.section>

      <motion.section variants={itemReveal}>
        <LeadTimeline timeline={timeline} />
      </motion.section>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editingLead}
        organizationId={organizationId}
        hostelId={hostelId}
      />
    </motion.div>
  )
}

function PipelineCard({
  label,
  status,
  count,
  icon: Icon,
  active,
}: {
  label: string
  status: LeadStatus | "all"
  count: number
  icon: LucideIcon
  active: boolean
}) {
  return (
    <motion.article variants={itemReveal}>
      <div
        className={cn(
          "group rounded-xl border bg-card/90 p-4 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted",
          active && "border-primary/40 shadow-[0_22px_54px_-34px_var(--primary)]"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-xl ring-1",
              active
                ? "bg-primary text-primary-foreground ring-primary/30"
                : "bg-info-surface text-info-foreground ring-info/20"
            )}
          >
            <Icon className="size-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
          </span>
          <StatusBadge status={status === "all" ? "active" : status} />
        </div>
        <p className="mt-4 text-3xl font-semibold tracking-tight">{count}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </motion.article>
  )
}

function LeadCard({ lead, onUpdate }: { lead: LeadRow; onUpdate: () => void }) {
  return (
    <motion.article variants={itemReveal} layout>
      <Card className="group h-full overflow-visible">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
                  {lead.full_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{lead.full_name}</CardTitle>
                  <CardDescription className="truncate">
                    {humanizeEnum(lead.resident_type)} inquiry
                  </CardDescription>
                </div>
              </div>
            </div>
            <LeadQuickMenu lead={lead} onUpdate={onUpdate} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={lead.status} />
            <Badge variant="secondary">{humanizeEnum(lead.source)}</Badge>
          </div>

          <div className="grid gap-2 text-sm">
            <ContactLine icon={Phone} value={lead.phone} />
            {lead.whatsapp_number ? <ContactLine icon={Phone} value={`WA ${lead.whatsapp_number}`} /> : null}
            {lead.email ? <ContactLine icon={Mail} value={lead.email} /> : null}
            <ContactLine
              icon={CalendarClock}
              value={`Joining ${formatDate(lead.desired_joining_date)}`}
            />
          </div>

          <div className="rounded-xl border bg-white/55 p-3 opacity-95 transition-all duration-300 group-hover:bg-white/75">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" aria-hidden="true" />
              <p className="text-xs font-medium text-foreground">Lead timeline</p>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <TimelinePoint label="Created" value={formatDate(lead.created_at)} />
              <TimelinePoint
                label="Last contacted"
                value={lead.last_contacted_at ? formatDate(lead.last_contacted_at) : "Not contacted"}
              />
              <TimelinePoint
                label="Next follow-up"
                value={lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : "Not scheduled"}
              />
            </div>
          </div>

          {lead.notes ? (
            <p className="line-clamp-2 rounded-lg bg-muted/55 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {lead.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </motion.article>
  )
}

function LeadQuickMenu({ lead, onUpdate }: { lead: LeadRow; onUpdate: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Open actions for ${lead.full_name}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onUpdate}>Update lead</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`tel:${lead.phone}`}>Call lead</a>
        </DropdownMenuItem>
        {lead.whatsapp_number ? (
          <DropdownMenuItem asChild>
            <a href={`https://wa.me/${lead.whatsapp_number}`} target="_blank" rel="noreferrer">
              Open WhatsApp
            </a>
          </DropdownMenuItem>
        ) : null}
        {lead.email ? (
          <DropdownMenuItem asChild>
            <a href={`mailto:${lead.email}`}>Email lead</a>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ContactLine({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{value}</span>
    </div>
  )
}

function TimelinePoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

function LeadTimeline({
  timeline,
}: {
  timeline: Array<{ id: string; title: string; description: string; date: string; status: LeadStatus }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Timeline</CardTitle>
        <CardDescription>Recent visible lead movement and follow-up state.</CardDescription>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <EmptyState title="No timeline yet" message="Lead activity will appear after inquiries are created." />
        ) : (
          <div className="relative grid gap-4 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
            {timeline.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="relative grid grid-cols-[2rem_1fr] gap-3"
              >
                <span className="relative z-10 flex size-8 items-center justify-center rounded-full border bg-background text-primary shadow-sm">
                  <UserRoundPlus className="size-4" aria-hidden="true" />
                </span>
                <div className="rounded-xl border bg-white/55 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(event.date)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function buildLeadPipeline(rows: LeadRow[]) {
  const count = (statuses: LeadStatus[]) =>
    rows.filter((lead) => statuses.includes(lead.status)).length

  return [
    {
      label: "All visible leads",
      status: "all" as const,
      count: rows.length,
      icon: UserRoundPlus,
    },
    {
      label: "Fresh inquiries",
      status: "new_inquiry" as const,
      count: count(["new_inquiry", "called"]),
      icon: Search,
    },
    {
      label: "High intent",
      status: "interested" as const,
      count: count(["interested", "reserved", "confirmed"]),
      icon: Sparkles,
    },
    {
      label: "Converted",
      status: "joined" as const,
      count: count(["joined"]),
      icon: UserRoundPlus,
    },
  ]
}

function buildLeadTimeline(rows: LeadRow[]) {
  return rows
    .map((lead) => ({
      id: lead.id,
      title: lead.full_name,
      description: `${humanizeEnum(lead.source)} inquiry for ${lead.desired_joining_date ? formatDate(lead.desired_joining_date) : "unscheduled joining"}`,
      date: lead.last_contacted_at ?? lead.next_follow_up_at ?? lead.updated_at ?? lead.created_at,
      status: lead.status,
    }))
    .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
    .slice(0, 6)
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
