"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { CalendarCheck, Loader2, MessageCircle, Plus, Search } from "lucide-react"
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

export function AdminReservationsClient() {
  const { organizationId, session } = useAuth()
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
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })

  if (!organizationId || !hostelId) {
    return (
      <EmptyState
        title="Hostel context required"
        message="Reservations need an active organization and hostel assignment."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">Admissions</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Reservations
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Hold beds for qualified leads, track booking advances, and convert confirmed
            reservations into residents.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Create reservation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reservation Queue</CardTitle>
          <CardDescription>
            Capacity is held atomically so concurrent bookings cannot over-reserve rooms.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
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
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reservation</TableHead>
                    <TableHead>Beds</TableHead>
                    <TableHead>Reserved Until</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((reservation) => (
                    <ReservationTableRow
                      key={reservation.id}
                      reservation={reservation}
                      lead={leadsById.get(reservation.lead_id)}
                      onManage={() => setActionReservation(reservation)}
                      onAdvance={() => setPaymentReservation(reservation)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {rows.length} of {meta?.total ?? 0} reservations
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
    </div>
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
              Reserve beds for a lead. Capacity validation happens inside PostgreSQL.
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
            <Field label="Beds">
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
              Reserve beds
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReservationTableRow({
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
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">
          {lead?.full_name ?? reservation.id.slice(0, 8).toUpperCase()}
        </div>
        <div className="text-xs text-muted-foreground">
          {lead ? `${lead.phone} · ${humanizeEnum(lead.source)}` : `Lead ${reservation.lead_id.slice(0, 8).toUpperCase()}`}
        </div>
      </TableCell>
      <TableCell>{reservation.reserved_bed_count}</TableCell>
      <TableCell>{formatDateTime(reservation.reserved_until)}</TableCell>
      <TableCell>{formatCurrency(reservation.advance_amount)}</TableCell>
      <TableCell>
        <StatusBadge status={reservation.status} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canConfirm(reservation)}
            onClick={onManage}
          >
            Manage
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={reservation.status === "cancelled"}
            onClick={onAdvance}
          >
            Advance
          </Button>
        </div>
      </TableCell>
    </TableRow>
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
    toast.success("Reservation cancelled and beds released.")
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
              {reservation.reserved_bed_count} bed(s) held until{" "}
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
