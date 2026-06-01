"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  UserRoundCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { motion, type Variants } from "framer-motion"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { LoadingState } from "@/components/shared/loading-state"
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
import {
  useCancelReservation,
  useConfirmReservation,
  useCreateResidentInvite,
  useConvertReservation,
  useCreateReservation,
  useCreateReservationPayment,
  useLeads,
  useReservations,
  useRooms,
} from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatCurrency, formatDateTime, humanizeEnum } from "@/lib/format"
import { useRealtimeAdmissions } from "@/lib/realtime"
import { cn } from "@/lib/utils"
import type { LeadRow, ReservationRow, ReservationStatus } from "@/types/admissions"
import type { Tables } from "@/types/database"

const PAGE_SIZE = 12
const reservationStatuses: Array<ReservationStatus | "all"> = [
  "all",
  "pending",
  "reserved",
  "confirmed",
  "expired",
  "cancelled",
  "converted_to_resident",
]

const kanbanStatuses: ReservationStatus[] = [
  "pending",
  "reserved",
  "confirmed",
  "converted_to_resident",
]

const reveal: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

export function AdminReservationsClient() {
  const { organizationId, session, isLoading } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<ReservationStatus | "all">("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [actionReservation, setActionReservation] = useState<ReservationRow | null>(null)
  const [paymentReservation, setPaymentReservation] = useState<ReservationRow | null>(null)

  const reservations = useReservations({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    search: search.trim() || undefined,
  })
  const leads = useLeads({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 100,
  })
  const rooms = useRooms({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 100,
    status: "active",
  })
  const rows = reservations.data?.data ?? []
  const meta = reservations.data?.meta
  const leadsById = new Map((leads.data?.data ?? []).map((lead) => [lead.id, lead]))
  const workflow = buildReservationWorkflow(rows)
  const timeline = buildReservationTimeline(rows, leadsById)
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })

  if (isLoading) {
    return <LoadingState rows={4} />
  }

  if (!organizationId || !hostelId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-6">
      <motion.div variants={reveal} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            <Sparkles className="size-3" aria-hidden="true" />
            Admission workflow
          </Badge>
          <h1 className="text-gradient text-3xl font-semibold tracking-tight md:text-4xl">
            Reservations
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Hold student spots for qualified leads, track booking advances, and convert confirmed
            reservations into residents.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Create reservation
        </Button>
      </motion.div>

      <motion.section variants={stagger} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflow.map((item) => (
          <WorkflowCard key={item.label} {...item} />
        ))}
      </motion.section>

      <motion.section variants={reveal}>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Reservation Kanban</CardTitle>
              <CardDescription>
                Capacity is held atomically so concurrent bookings cannot over-reserve rooms.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-success shadow-[0_0_12px_var(--success)]" />
              Showing {rows.length} of {meta?.total ?? 0} reservations
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <motion.div layout className="grid gap-3 rounded-xl border bg-white/55 p-3 md:grid-cols-[1fr_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="pl-9"
                placeholder="Search lead name, phone, WhatsApp, email, or ID"
                aria-label="Search reservations"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as ReservationStatus | "all")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reservationStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "all" ? "All statuses" : humanizeEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {reservationStatuses.map((item) => {
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
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-white/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {selected ? (
                    <motion.span
                      layoutId="reservation-filter-active"
                      className="absolute inset-0 rounded-full ring-1 ring-primary/45"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="relative">
                    {item === "all" ? "All reservations" : humanizeEnum(item)}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {reservations.isLoading ? (
            <ReservationSkeleton />
          ) : reservations.isError ? (
            <APIErrorState
              title="Reservations failed to load"
              error={reservations.error}
              onRetry={() => void reservations.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No reservations found"
              message="Create a reservation once a lead is interested and vacancy is available."
              action={<Button onClick={() => setIsCreateOpen(true)}>Create reservation</Button>}
            />
          ) : (
            <KanbanBoard
              reservations={rows}
              leadsById={leadsById}
              onManage={setActionReservation}
              onAdvance={setPaymentReservation}
            />
          )}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {meta?.page ?? page} of {meta?.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!meta || page <= 1 || reservations.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!meta || page >= meta.totalPages || reservations.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.section>

      <motion.section variants={reveal} className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <InquiryAdmissionVisualization rows={rows} />
        <ReservationTimeline timeline={timeline} />
      </motion.section>

      <CreateReservationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        organizationId={organizationId}
        hostelId={hostelId}
        leads={leads.data?.data ?? []}
        rooms={rooms.data?.data ?? []}
      />
      <ReservationActionDialog
        reservation={actionReservation}
        onOpenChange={(open) => {
          if (!open) {
            setActionReservation(null)
          }
        }}
        organizationId={organizationId}
      />
      <AdvancePaymentDialog
        reservation={paymentReservation}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentReservation(null)
          }
        }}
        organizationId={organizationId}
      />
    </motion.div>
  )
}

function WorkflowCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  detail: string
  icon: LucideIcon
  tone: "success" | "warning" | "info" | "danger"
}) {
  const toneClassName = {
    success: "bg-success-surface text-success-foreground ring-success/20",
    warning: "bg-warning-surface text-warning-foreground ring-warning/25",
    info: "bg-info-surface text-info-foreground ring-info/20",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
  }[tone]

  return (
    <motion.article variants={reveal}>
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="mt-2 text-2xl">{value}</CardTitle>
            </div>
            <span className={`flex size-10 items-center justify-center rounded-xl ring-1 ${toneClassName}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </div>
          <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
        </CardHeader>
      </Card>
    </motion.article>
  )
}

function KanbanBoard({
  reservations,
  leadsById,
  onManage,
  onAdvance,
}: {
  reservations: ReservationRow[]
  leadsById: Map<string, LeadRow>
  onManage: (reservation: ReservationRow) => void
  onAdvance: (reservation: ReservationRow) => void
}) {
  const inactive = reservations.filter((reservation) =>
    ["expired", "cancelled"].includes(reservation.status)
  )

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {kanbanStatuses.map((status) => {
        const items = reservations.filter((reservation) => reservation.status === status)

        return (
          <KanbanColumn
            key={status}
            title={humanizeEnum(status)}
            status={status}
            reservations={items}
            leadsById={leadsById}
            onManage={onManage}
            onAdvance={onAdvance}
          />
        )
      })}
      {inactive.length > 0 ? (
        <div className="xl:col-span-4">
          <KanbanColumn
            title="Closed / expired"
            status="cancelled"
            reservations={inactive}
            leadsById={leadsById}
            onManage={onManage}
            onAdvance={onAdvance}
            compact
          />
        </div>
      ) : null}
    </div>
  )
}

function KanbanColumn({
  title,
  status,
  reservations,
  leadsById,
  onManage,
  onAdvance,
  compact = false,
}: {
  title: string
  status: ReservationStatus
  reservations: ReservationRow[]
  leadsById: Map<string, LeadRow>
  onManage: (reservation: ReservationRow) => void
  onAdvance: (reservation: ReservationRow) => void
  compact?: boolean
}) {
  return (
    <section className="rounded-xl border bg-muted/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", statusDotClassName(status))} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary">{reservations.length}</Badge>
      </div>
      {reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white/45 p-4 text-center text-sm text-muted-foreground">
          No reservations
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className={cn("grid gap-3", compact && "md:grid-cols-2 xl:grid-cols-3")}
        >
          {reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              lead={leadsById.get(reservation.lead_id)}
              onManage={() => onManage(reservation)}
              onAdvance={() => onAdvance(reservation)}
            />
          ))}
        </motion.div>
      )}
    </section>
  )
}

function ReservationCard({
  reservation,
  lead,
  onManage,
  onAdvance,
}: {
  reservation: ReservationRow
  lead?: LeadRow
  onManage: () => void
  onAdvance: () => void
}) {
  const canRecordAdvance = reservation.status !== "cancelled"

  return (
    <motion.article variants={reveal} layout>
      <div className="group rounded-xl border bg-card/90 p-4 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {lead?.full_name ?? reservation.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {lead
                ? `${lead.phone} · ${humanizeEnum(lead.source)}`
                : `Lead ${reservation.lead_id.slice(0, 8).toUpperCase()}`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Reservation actions">
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Workflow actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!canConfirm(reservation)} onClick={onManage}>
                Manage approval
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canRecordAdvance} onClick={onAdvance}>
                Record advance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={reservation.status} />
          <Badge variant="secondary">{reservation.reserved_bed_count} spot(s)</Badge>
        </div>

        <div className="mt-4 grid gap-2 rounded-xl border bg-white/55 p-3 text-xs text-muted-foreground">
          <ReservationFact label="Reserved until" value={formatDateTime(reservation.reserved_until)} />
          <ReservationFact label="Advance" value={formatCurrency(reservation.advance_amount)} />
          <ReservationFact label="Room" value={reservation.reserved_room_id ? reservation.reserved_room_id.slice(0, 8) : "Any room"} />
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" disabled={!canConfirm(reservation)} onClick={onManage}>
            Manage
          </Button>
          <Button size="sm" variant="ghost" disabled={!canRecordAdvance} onClick={onAdvance}>
            Advance
          </Button>
        </div>
      </div>
    </motion.article>
  )
}

function ReservationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

function InquiryAdmissionVisualization({ rows }: { rows: ReservationRow[] }) {
  const steps = [
    { label: "Inquiry", value: rows.length, icon: Search },
    { label: "Capacity held", value: rows.filter((row) => ["pending", "reserved"].includes(row.status)).length, icon: CalendarCheck },
    { label: "Confirmed", value: rows.filter((row) => row.status === "confirmed").length, icon: CheckCircle2 },
    { label: "Admitted", value: rows.filter((row) => row.status === "converted_to_resident").length, icon: UserRoundCheck },
  ]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Inquiry-to-Admission Flow</CardTitle>
        <CardDescription>Current page reservations mapped across the admission lifecycle.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon

            return (
              <div key={step.label} className="relative rounded-xl border bg-white/55 p-4">
                {index < steps.length - 1 ? (
                  <ArrowRight className="absolute -right-4 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-muted-foreground sm:block" />
                ) : null}
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <p className="mt-4 text-2xl font-semibold">{step.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.label}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ReservationTimeline({
  timeline,
}: {
  timeline: Array<{ id: string; title: string; description: string; at: string; status: ReservationStatus }>
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Reservation Timeline</CardTitle>
        <CardDescription>Recent holds, confirmations, and admission conversions.</CardDescription>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <EmptyState title="No timeline yet" message="Reservation movement will appear here." />
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
                  <Clock3 className="size-4" aria-hidden="true" />
                </span>
                <div className="rounded-xl border bg-white/55 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CreateReservationDialog({
  open,
  onOpenChange,
  organizationId,
  hostelId,
  leads,
  rooms,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  hostelId: string
  leads: LeadRow[]
  rooms: Array<Tables<"rooms">>
}) {
  const createReservation = useCreateReservation()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const reservedUntil = String(formData.get("reservedUntil") ?? "")

    await createReservation.mutateAsync({
      organizationId,
      hostelId,
      leadId: String(formData.get("leadId") ?? ""),
      reservedRoomId: emptyToUndefined(formData.get("reservedRoomId")),
      reservedBedCount: Number(formData.get("reservedBedCount") ?? 1),
      reservedUntil: new Date(reservedUntil).toISOString(),
      advanceAmount: Number(formData.get("advanceAmount") ?? 0),
      notes: emptyToUndefined(formData.get("notes")),
    })
    toast.success("Reservation created and capacity held.")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create Reservation</DialogTitle>
            <DialogDescription>
              Reserve student capacity for a lead. Capacity validation happens inside PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Lead">
              <Select name="leadId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.full_name} · {lead.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Room">
              <Select name="reservedRoomId">
                <SelectTrigger>
                  <SelectValue placeholder="Any available room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any available room</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.room_number} · {room.room_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Students">
              <Input name="reservedBedCount" type="number" min={1} max={10} defaultValue={1} />
            </Field>
            <Field label="Hold until">
              <Input
                name="reservedUntil"
                type="datetime-local"
                defaultValue={defaultReservationDateTime()}
                required
              />
            </Field>
            <Field label="Advance amount">
              <Input name="advanceAmount" type="number" min={0} step={100} defaultValue={0} />
            </Field>
            <div className="grid gap-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea name="notes" rows={3} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createReservation.isPending} className="gap-2">
              {createReservation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Reserve spot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReservationActionDialog({
  reservation,
  onOpenChange,
  organizationId,
}: {
  reservation: ReservationRow | null
  onOpenChange: (open: boolean) => void
  organizationId: string
}) {
  const confirmReservation = useConfirmReservation()
  const cancelReservation = useCancelReservation()
  const convertReservation = useConvertReservation()
  const createInvite = useCreateResidentInvite()
  const [activationLink, setActivationLink] = useState<string | null>(null)
  const [whatsappShareUrl, setWhatsappShareUrl] = useState<string | null>(null)
  const pending =
    confirmReservation.isPending ||
    cancelReservation.isPending ||
    convertReservation.isPending ||
    createInvite.isPending

  async function confirm() {
    if (!reservation) {
      return
    }

    await confirmReservation.mutateAsync({ organizationId, reservationId: reservation.id })
    toast.success("Reservation confirmed.")
    onOpenChange(false)
  }

  async function cancel() {
    if (!reservation) {
      return
    }

    await cancelReservation.mutateAsync({
      organizationId,
      reservationId: reservation.id,
      reason: "Cancelled from admissions dashboard.",
    })
    toast.success("Reservation cancelled and student spot released.")
    onOpenChange(false)
  }

  async function convert() {
    if (!reservation) {
      return
    }

    const resident = await convertReservation.mutateAsync({
      organizationId,
      reservationId: reservation.id,
      joinedOn: new Date().toISOString().slice(0, 10),
      securityDepositAmount: 0,
    })
    const invite = await createInvite.mutateAsync({
      organizationId,
      residentId: resident.id,
      deliveryChannel: "whatsapp",
      expiresInHours: 72,
    })
    setActivationLink(invite.activationLink)
    setWhatsappShareUrl(invite.whatsappShareUrl)
    toast.success("Admission approved and resident activation invite generated.")
  }

  async function copyLink() {
    if (!activationLink) {
      return
    }

    await navigator.clipboard.writeText(activationLink)
    toast.success("Invite link copied.")
  }

  return (
    <Dialog
      open={Boolean(reservation)}
      onOpenChange={(open) => {
        if (!open) {
          setActivationLink(null)
          setWhatsappShareUrl(null)
        }
        onOpenChange(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Reservation</DialogTitle>
          <DialogDescription>
            Confirm, cancel, or convert this admission reservation.
          </DialogDescription>
        </DialogHeader>

        {reservation ? (
          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <CalendarCheck className="size-4 text-blue-700" />
              {reservation.id.slice(0, 8).toUpperCase()}
            </div>
            <p className="mt-2 text-muted-foreground">
              {reservation.reserved_bed_count} student spot(s) held until{" "}
              {formatDateTime(reservation.reserved_until)}.
            </p>
          </div>
        ) : null}

        {activationLink ? (
          <div className="rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">Resident invite generated</p>
            <p className="mt-2 break-all text-xs">{activationLink}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyLink()}
              >
                Copy invite link
              </Button>
              {whatsappShareUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a href={whatsappShareUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    WhatsApp invite
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !reservation || reservation.status === "cancelled"}
            onClick={() => void cancel()}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !reservation || !canConfirm(reservation)}
              onClick={() => void confirm()}
            >
              Confirm
            </Button>
            <Button
              type="button"
              disabled={pending || !reservation || !canConvert(reservation)}
              onClick={() => void convert()}
            >
              Approve & invite
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdvancePaymentDialog({
  reservation,
  onOpenChange,
  organizationId,
}: {
  reservation: ReservationRow | null
  onOpenChange: (open: boolean) => void
  organizationId: string
}) {
  const createPayment = useCreateReservationPayment()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reservation) {
      return
    }

    const formData = new FormData(event.currentTarget)
    await createPayment.mutateAsync({
      organizationId,
      hostelId: reservation.hostel_id,
      reservationId: reservation.id,
      leadId: reservation.lead_id,
      amount: Number(formData.get("amount") ?? 0),
      method: String(formData.get("method") ?? "upi") as "upi",
      transactionId: emptyToUndefined(formData.get("transactionId")),
      notes: emptyToUndefined(formData.get("notes")),
      paidAt: new Date().toISOString(),
    })
    toast.success("Advance payment recorded for verification.")
    onOpenChange(false)
  }

  return (
    <Dialog open={Boolean(reservation)} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Record Advance Payment</DialogTitle>
            <DialogDescription>
              Capture UPI/cash advance details against this reservation.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <Field label="Amount">
              <Input name="amount" type="number" min={1} step={100} required />
            </Field>
            <Field label="Method">
              <Select name="method" defaultValue="upi">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="advance">Advance Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Transaction reference">
              <Input name="transactionId" placeholder="UPI reference or receipt number" />
            </Field>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea name="notes" rows={3} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPayment.isPending} className="gap-2">
              {createPayment.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Record advance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReservationSkeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-14 rounded-lg border bg-muted/50" />
      ))}
    </div>
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

function buildReservationWorkflow(rows: ReservationRow[]) {
  const advanceTotal = rows.reduce((total, row) => total + row.advance_amount, 0)

  return [
    {
      label: "Open approvals",
      value: rows.filter((row) => ["pending", "reserved"].includes(row.status)).length,
      detail: "Need confirmation or cancellation",
      icon: CalendarCheck,
      tone: "warning" as const,
    },
    {
      label: "Confirmed holds",
      value: rows.filter((row) => row.status === "confirmed").length,
      detail: "Ready for admission conversion",
      icon: CheckCircle2,
      tone: "success" as const,
    },
    {
      label: "Advance collected",
      value: formatCurrency(advanceTotal),
      detail: "Booking advance on current page",
      icon: CreditCard,
      tone: "info" as const,
    },
    {
      label: "Closed reservations",
      value: rows.filter((row) => ["expired", "cancelled"].includes(row.status)).length,
      detail: "Expired or cancelled holds",
      icon: XCircle,
      tone: "danger" as const,
    },
  ]
}

function buildReservationTimeline(rows: ReservationRow[], leadsById: Map<string, LeadRow>) {
  return rows
    .map((reservation) => {
      const lead = leadsById.get(reservation.lead_id)

      return {
        id: reservation.id,
        title: lead?.full_name ?? reservation.id.slice(0, 8).toUpperCase(),
        description: `${reservation.reserved_bed_count} spot(s), ${formatCurrency(reservation.advance_amount)} advance`,
        at: reservation.converted_at ??
          reservation.confirmed_at ??
          reservation.cancelled_at ??
          reservation.expired_at ??
          reservation.created_at,
        status: reservation.status,
      }
    })
    .sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime())
    .slice(0, 6)
}

function statusDotClassName(status: ReservationStatus) {
  if (status === "converted_to_resident" || status === "confirmed") {
    return "bg-success shadow-[0_0_12px_var(--success)]"
  }

  if (status === "pending" || status === "reserved") {
    return "bg-warning shadow-[0_0_12px_var(--warning)]"
  }

  if (status === "expired" || status === "cancelled") {
    return "bg-destructive shadow-[0_0_12px_var(--destructive)]"
  }

  return "bg-info shadow-[0_0_12px_var(--info)]"
}

function canConfirm(reservation: ReservationRow) {
  return reservation.status === "pending" || reservation.status === "reserved"
}

function canConvert(reservation: ReservationRow) {
  return reservation.status === "confirmed" || reservation.status === "reserved"
}

function emptyToUndefined(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim()

  return stringValue && stringValue !== "none" ? stringValue : undefined
}

function defaultReservationDateTime() {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  date.setMinutes(0, 0, 0)

  return date.toISOString().slice(0, 16)
}
