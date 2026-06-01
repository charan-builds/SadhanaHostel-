"use client"

import { useEffect, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Bath,
  BedDouble,
  Building2,
  DoorOpen,
  Edit,
  Layers,
  Loader2,
  Plus,
  Search,
  Snowflake,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"
import { motion, type Variants } from "framer-motion"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { StatusBadge } from "@/components/shared/status-badge"
import { PageHeader } from "@/components/shared/page-header"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { HOSTEL_FEES } from "@/constants/hostel"
import { useAuth } from "@/lib/auth"
import { formatCurrency, humanizeEnum } from "@/lib/format"
import { useRealtimeAdmissions } from "@/lib/realtime"
import {
  useAllocateRoom,
  useCreateRoom,
  useResidents,
  useRooms,
  useTransferRoom,
  useUpdateRoom,
} from "@/hooks"
import type { Tables } from "@/types/database"

const PAGE_SIZE = 12
const roomStatuses = ["active", "maintenance", "inactive", "archived"] as const

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

const roomFormSchema = z.object({
  roomNumber: z.string().trim().min(1, "Room number is required").max(40),
  roomName: z.string().trim().max(120).optional(),
  roomType: z.string().trim().min(1, "Room type is required").max(80),
  floor: z.string().trim().max(40).optional(),
  blockName: z.string().trim().max(80).optional(),
  capacity: z.coerce.number().int().positive().max(50),
  baseMonthlyFee: z.coerce.number().min(0),
  hasAttachedBathroom: z.boolean(),
  hasAc: z.boolean(),
  status: z.enum(roomStatuses),
  description: z.string().trim().max(1000).optional(),
})

const allocationFormSchema = z.object({
  mode: z.enum(["allocate", "transfer"]).default("allocate"),
  residentId: z.string().uuid("Choose a resident"),
  bedLabel: z.string().trim().max(40).optional(),
  allocatedFrom: z.string().min(1, "Allocation date is required"),
  monthlyFeeAmount: z.coerce.number().min(0),
  reason: z.string().trim().max(500).optional(),
})

type RoomFormInput = z.input<typeof roomFormSchema>
type RoomFormValues = z.output<typeof roomFormSchema>
type AllocationFormInput = z.input<typeof allocationFormSchema>
type AllocationFormValues = z.output<typeof allocationFormSchema>

export function AdminRoomsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  useRealtimeAdmissions({ enabled: Boolean(organizationId) })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<(typeof roomStatuses)[number] | "all">("all")
  const [editingRoom, setEditingRoom] = useState<Tables<"rooms"> | null>(null)
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false)
  const [allocatingRoom, setAllocatingRoom] = useState<Tables<"rooms"> | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Tables<"rooms"> | null>(null)

  const roomsQuery = useRooms({
    organizationId: organizationId ?? "",
    hostelId,
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  })

  const residentsQuery = useResidents({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 100,
  })

  const rooms = roomsQuery.data?.data ?? []
  const allocatableResidents =
    residentsQuery.data?.data.filter((resident) =>
      ["draft", "active"].includes(resident.status)
    ) ?? []
  const meta = roomsQuery.data?.meta
  const activeRooms = rooms.filter((room) => room.status === "active").length
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0)
  const totalOccupied = rooms.reduce((sum, room) => sum + getRoomOccupancy(room).occupied, 0)
  const totalVacant = Math.max(totalCapacity - totalOccupied, 0)

  if (!organizationId || !hostelId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Rooms"
        description="Visual room inventory, pricing, availability, and resident allocation controls."
        actions={
          <Button
            onClick={() => {
              setEditingRoom(null)
              setIsRoomDialogOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add room
          </Button>
        }
      />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <RoomMetric label="Rooms on page" value={rooms.length} icon={Building2} tone="info" />
        <RoomMetric label="Active rooms" value={activeRooms} icon={DoorOpen} tone="success" />
        <RoomMetric label="Page capacity" value={totalCapacity} icon={BedDouble} tone="neutral" />
        <RoomMetric label="Visual vacancies" value={totalVacant} icon={Users} tone="warning" />
      </motion.div>

      <Card>
        <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Interactive Room Layout</CardTitle>
            <CardDescription>
              Manage rooms, monthly pricing, availability, and resident allocation.
            </CardDescription>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingRoom(null)
              setIsRoomDialogOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add room
          </Button>
        </CardHeader>
        <CardContent className="grid gap-5">
          <motion.div layout className="flex flex-col gap-3 rounded-xl border bg-white/55 p-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="pl-9"
                placeholder="Search by room number, name, block"
                aria-label="Search rooms"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as typeof status)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-48" aria-label="Filter rooms by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {roomStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanizeEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          {roomsQuery.isLoading ? (
            <RoomGridSkeleton />
          ) : roomsQuery.isError ? (
            <APIErrorState
              title="Rooms could not be loaded"
              error={roomsQuery.error}
              onRetry={() => void roomsQuery.refetch()}
            />
          ) : rooms.length === 0 ? (
            <EmptyState
              title={search || status !== "all" ? "No rooms match these filters" : "No rooms yet"}
              message={
                search || status !== "all"
                  ? "Clear the filters or adjust the search to find existing rooms."
                  : "Create your first room so vacancy, allocation, and pricing can work automatically."
              }
              action={
                search || status !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("")
                      setStatus("all")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => setIsRoomDialogOpen(true)}>Create room</Button>
                )
              }
            />
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {rooms.map((room) => (
                <RoomVisualCard
                  key={room.id}
                  room={room}
                  onOpen={() => setSelectedRoom(room)}
                  onAllocate={() => setAllocatingRoom(room)}
                  onEdit={() => {
                    setEditingRoom(room)
                    setIsRoomDialogOpen(true)
                  }}
                />
              ))}
            </motion.div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {rooms.length} of {meta?.total ?? 0} rooms
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!meta || page <= 1 || roomsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!meta || page >= meta.totalPages || roomsQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <RoomEditorDialog
        open={isRoomDialogOpen}
        onOpenChange={setIsRoomDialogOpen}
        room={editingRoom}
        organizationId={organizationId}
        hostelId={hostelId}
      />
      <AllocateRoomDialog
        open={Boolean(allocatingRoom)}
        onOpenChange={(open) => {
          if (!open) {
            setAllocatingRoom(null)
          }
        }}
        room={allocatingRoom}
        organizationId={organizationId}
        hostelId={hostelId}
        residents={allocatableResidents}
      />
      <RoomDetailDrawer
        room={selectedRoom}
        open={Boolean(selectedRoom)}
        onOpenChange={(open) => !open && setSelectedRoom(null)}
        onAllocate={() => {
          if (selectedRoom) {
            setAllocatingRoom(selectedRoom)
            setSelectedRoom(null)
          }
        }}
        onEdit={() => {
          if (selectedRoom) {
            setEditingRoom(selectedRoom)
            setIsRoomDialogOpen(true)
            setSelectedRoom(null)
          }
        }}
      />
    </div>
  )
}

function RoomEditorDialog({
  open,
  onOpenChange,
  room,
  organizationId,
  hostelId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: Tables<"rooms"> | null
  organizationId: string
  hostelId: string
}) {
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const form = useForm<RoomFormInput, unknown, RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: getRoomDefaults(room),
  })

  useEffect(() => {
    form.reset(getRoomDefaults(room))
  }, [form, room])

  async function onSubmit(values: RoomFormValues) {
    if (room) {
      await updateRoom.mutateAsync({
        roomId: room.id,
        organizationId,
        ...values,
      })
      toast.success("Room updated.")
    } else {
      await createRoom.mutateAsync({
        organizationId,
        hostelId,
        roomNumber: values.roomNumber,
        roomName: values.roomName,
        roomType: values.roomType,
        floor: values.floor,
        blockName: values.blockName,
        capacity: values.capacity,
        baseMonthlyFee: values.baseMonthlyFee,
        hasAttachedBathroom: values.hasAttachedBathroom,
        hasAc: values.hasAc,
        description: values.description,
      })
      toast.success("Room created.")
    }

    onOpenChange(false)
  }

  const isPending = createRoom.isPending || updateRoom.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{room ? "Edit Room" : "Add Room"}</DialogTitle>
            <DialogDescription>
              Room records drive occupancy, allocation, and fee defaults.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField label="Room number" error={form.formState.errors.roomNumber?.message}>
              <Input {...form.register("roomNumber")} disabled={Boolean(room)} />
            </FormField>
            <FormField label="Room name" error={form.formState.errors.roomName?.message}>
              <Input {...form.register("roomName")} />
            </FormField>
            <FormField label="Room type" error={form.formState.errors.roomType?.message}>
              <Input {...form.register("roomType")} placeholder="student, employee, shared" />
            </FormField>
            <FormField label="Capacity" error={form.formState.errors.capacity?.message}>
              <Input type="number" min={1} {...form.register("capacity")} />
            </FormField>
            <FormField label="Monthly fee" error={form.formState.errors.baseMonthlyFee?.message}>
              <Input type="number" min={0} {...form.register("baseMonthlyFee")} />
            </FormField>
            <FormField label="Floor" error={form.formState.errors.floor?.message}>
              <Input {...form.register("floor")} />
            </FormField>
            <FormField label="Block" error={form.formState.errors.blockName?.message}>
              <Input {...form.register("blockName")} />
            </FormField>
            <FormField label="Status" error={form.formState.errors.status?.message}>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roomStatuses.map((item) => (
                        <SelectItem key={item} value={item}>
                          {humanizeEnum(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Attached bathroom">
              <Controller
                control={form.control}
                name="hasAttachedBathroom"
                render={({ field }) => (
                  <Select
                    value={field.value ? "yes" : "no"}
                    onValueChange={(value) => field.onChange(value === "yes")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="AC room">
              <Controller
                control={form.control}
                name="hasAc"
                render={({ field }) => (
                  <Select
                    value={field.value ? "yes" : "no"}
                    onValueChange={(value) => field.onChange(value === "yes")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <div className="grid gap-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={4} {...form.register("description")} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <DoorOpen className="size-4" aria-hidden="true" />
              )}
              {room ? "Save room" : "Create room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AllocateRoomDialog({
  open,
  onOpenChange,
  room,
  organizationId,
  hostelId,
  residents,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: Tables<"rooms"> | null
  organizationId: string
  hostelId: string
  residents: Tables<"residents">[]
}) {
  const allocateRoom = useAllocateRoom()
  const transferRoom = useTransferRoom()
  const today = new Date().toISOString().slice(0, 10)
  const form = useForm<AllocationFormInput, unknown, AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      mode: "allocate",
      residentId: "",
      bedLabel: "",
      allocatedFrom: today,
      monthlyFeeAmount: room?.base_monthly_fee ?? HOSTEL_FEES.student,
      reason: "",
    },
  })
  const lifecycleMode = useWatch({ control: form.control, name: "mode" })

  useEffect(() => {
    form.reset({
      mode: "allocate",
      residentId: "",
      bedLabel: "",
      allocatedFrom: today,
      monthlyFeeAmount: room?.base_monthly_fee ?? HOSTEL_FEES.student,
      reason: "",
    })
  }, [form, room, today])

  async function onSubmit(values: AllocationFormValues) {
    if (!room) {
      return
    }

    if (values.mode === "transfer") {
      await transferRoom.mutateAsync({
        organizationId,
        hostelId,
        toRoomId: room.id,
        residentId: values.residentId,
        bedLabel: values.bedLabel || undefined,
        transferDate: values.allocatedFrom,
        monthlyFeeAmount: values.monthlyFeeAmount || room.base_monthly_fee || HOSTEL_FEES.student,
        reason: values.reason,
      })
      toast.success("Resident transferred.")
    } else {
      await allocateRoom.mutateAsync({
        organizationId,
        hostelId,
        roomId: room.id,
        residentId: values.residentId,
        bedLabel: values.bedLabel || undefined,
        allocatedFrom: values.allocatedFrom,
        monthlyFeeAmount: values.monthlyFeeAmount || room.base_monthly_fee || HOSTEL_FEES.student,
        reason: values.reason,
      })
      toast.success("Room allocated.")
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Allocate {room?.room_number}</DialogTitle>
            <DialogDescription>
              Assign an active resident without exceeding room capacity.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            <FormField label="Lifecycle action" error={form.formState.errors.mode?.message}>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allocate">New allocation</SelectItem>
                      <SelectItem value="transfer">Transfer existing resident</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Resident" error={form.formState.errors.residentId?.message}>
              <Controller
                control={form.control}
                name="residentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose resident" />
                    </SelectTrigger>
                    <SelectContent>
                      {residents.map((resident) => (
                        <SelectItem key={resident.id} value={resident.id}>
                          {resident.full_name} · {resident.admission_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Room slot note" error={form.formState.errors.bedLabel?.message}>
                <Input {...form.register("bedLabel")} placeholder="Optional note" />
              </FormField>
              <FormField label="Allocated from" error={form.formState.errors.allocatedFrom?.message}>
                <Input type="date" {...form.register("allocatedFrom")} />
              </FormField>
              <FormField
                label="Monthly fee"
                error={form.formState.errors.monthlyFeeAmount?.message}
              >
                <Input type="number" min={0} {...form.register("monthlyFeeAmount")} />
              </FormField>
            </div>
            <div className="grid gap-2">
              <Label>Reason or note</Label>
              <Textarea rows={3} {...form.register("reason")} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={allocateRoom.isPending || transferRoom.isPending || residents.length === 0}
              className="gap-2"
            >
              {allocateRoom.isPending || transferRoom.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
              {lifecycleMode === "transfer" ? "Transfer resident" : "Allocate room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getRoomDefaults(room: Tables<"rooms"> | null): RoomFormInput {
  return {
    roomNumber: room?.room_number ?? "",
    roomName: room?.room_name ?? "",
    roomType: room?.room_type ?? "shared",
    floor: room?.floor ?? "",
    blockName: room?.block_name ?? "",
    capacity: room?.capacity ?? 1,
    baseMonthlyFee: room?.base_monthly_fee ?? HOSTEL_FEES.student,
    hasAttachedBathroom: room?.has_attached_bathroom ?? false,
    hasAc: room?.has_ac ?? false,
    status: room?.status ?? "active",
    description: room?.description ?? "",
  }
}

function RoomVisualCard({
  room,
  onOpen,
  onAllocate,
  onEdit,
}: {
  room: Tables<"rooms">
  onOpen: () => void
  onAllocate: () => void
  onEdit: () => void
}) {
  const occupancy = getRoomOccupancy(room)
  const vacancy = Math.max(room.capacity - occupancy.occupied, 0)
  const occupancyPercent =
    room.capacity > 0 ? Math.min(100, Math.round((occupancy.occupied / room.capacity) * 100)) : 0

  return (
    <motion.article
      variants={reveal}
      layout
      className="group flex h-full flex-col rounded-xl border bg-card/90 p-4 text-left shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted"
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left focus-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <DoorOpen className="size-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">
                  Room {room.room_number}
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {[room.block_name, room.floor, room.room_name].filter(Boolean).join(" · ") ||
                    "No location label"}
                </p>
              </div>
            </div>
          </div>
          <StatusBadge status={room.status} />
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Monthly fee</p>
              <p className="text-xl font-semibold">{formatCurrency(room.base_monthly_fee)}</p>
            </div>
            <Badge variant="secondary" className="capitalize">
              {humanizeEnum(room.room_type)}
            </Badge>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{occupancy.occupied}/{room.capacity} occupied</span>
              <span>{vacancy} available</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${occupancyPercent}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <BedChipGrid capacity={room.capacity} occupied={occupancy.occupied} status={room.status} />

          <div className="flex flex-wrap gap-2">
            <FacilityChip icon={Bath} label={room.has_attached_bathroom ? "Attached bath" : "Common bath"} />
            {room.has_ac ? <FacilityChip icon={Snowflake} label="AC" /> : null}
            {room.floor ? <FacilityChip icon={Layers} label={`Floor ${room.floor}`} /> : null}
          </div>
        </div>
      </button>

      <div className="mt-4 flex gap-2 border-t pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onAllocate}>
          <UserPlus className="size-4" aria-hidden="true" />
          Allocate
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="size-4" aria-hidden="true" />
          Edit
        </Button>
      </div>
    </motion.article>
  )
}

function RoomDetailDrawer({
  room,
  open,
  onOpenChange,
  onAllocate,
  onEdit,
}: {
  room: Tables<"rooms"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAllocate: () => void
  onEdit: () => void
}) {
  const occupancy = room ? getRoomOccupancy(room) : { occupied: 0, reserved: 0 }
  const vacancy = room ? Math.max(room.capacity - occupancy.occupied, 0) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {room ? (
          <>
            <SheetHeader className="border-b p-6 text-left">
              <div className="flex items-start gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <DoorOpen className="size-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl">Room {room.room_number}</SheetTitle>
                  <SheetDescription className="mt-1">
                    {[room.block_name, room.floor, room.room_name].filter(Boolean).join(" · ") ||
                      "No location label"}
                  </SheetDescription>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={room.status} />
                    <Badge variant="secondary" className="capitalize">
                      {humanizeEnum(room.room_type)}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="grid gap-5 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <RoomDrawerMetric label="Capacity" value={room.capacity} />
                <RoomDrawerMetric label="Available beds" value={vacancy} />
                <RoomDrawerMetric label="Occupied beds" value={occupancy.occupied} />
                <RoomDrawerMetric label="Monthly fee" value={formatCurrency(room.base_monthly_fee)} />
              </div>

              <section className="rounded-xl border bg-white/55 p-4">
                <h3 className="text-sm font-semibold text-foreground">Bed availability</h3>
                <div className="mt-4">
                  <BedChipGrid capacity={room.capacity} occupied={occupancy.occupied} status={room.status} large />
                </div>
              </section>

              <section className="rounded-xl border bg-white/55 p-4">
                <h3 className="text-sm font-semibold text-foreground">Facilities</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  <FacilityChip icon={Bath} label={room.has_attached_bathroom ? "Attached bathroom" : "Common bathroom"} />
                  <FacilityChip icon={Snowflake} label={room.has_ac ? "AC enabled" : "Non AC"} />
                  <FacilityChip icon={Layers} label={room.floor ? `Floor ${room.floor}` : "Floor not set"} />
                </div>
              </section>

              {room.description ? (
                <section className="rounded-xl border bg-white/55 p-4">
                  <h3 className="text-sm font-semibold text-foreground">Description</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{room.description}</p>
                </section>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button onClick={onAllocate}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Allocate resident
                </Button>
                <Button variant="outline" onClick={onEdit}>
                  <Edit className="size-4" aria-hidden="true" />
                  Edit room
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function BedChipGrid({
  capacity,
  occupied,
  status,
  large = false,
}: {
  capacity: number
  occupied: number
  status: Tables<"rooms">["status"]
  large?: boolean
}) {
  const visibleBeds = Math.min(capacity, large ? 50 : 12)

  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: visibleBeds }).map((_, index) => {
        const isOccupied = index < occupied
        const blocked = status !== "active"

        return (
          <span
            key={index}
            className={
              blocked
                ? "inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground ring-1 ring-border"
                : isOccupied
                  ? "inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary/15 text-[10px] font-medium text-primary ring-1 ring-primary/20"
                  : "inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-success-surface text-[10px] font-medium text-success-foreground ring-1 ring-success/20"
            }
            title={blocked ? "Blocked" : isOccupied ? "Occupied" : "Available"}
          >
            {index + 1}
          </span>
        )
      })}
      {capacity > visibleBeds ? (
        <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-[10px] font-medium text-muted-foreground">
          +{capacity - visibleBeds}
        </span>
      ) : null}
    </div>
  )
}

function FacilityChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-white/65 px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

function RoomDrawerMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white/55 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function getRoomOccupancy(room: Tables<"rooms">) {
  const metadata = room.metadata && typeof room.metadata === "object" && !Array.isArray(room.metadata)
    ? room.metadata as Record<string, unknown>
    : {}
  const occupied = readNumber(metadata.occupiedBeds) ?? readNumber(metadata.occupied_beds) ?? 0
  const reserved = readNumber(metadata.reservedBeds) ?? readNumber(metadata.reserved_beds) ?? 0

  return {
    occupied: Math.min(room.capacity, Math.max(0, occupied + reserved)),
    reserved: Math.max(0, reserved),
  }
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function RoomMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone: "success" | "warning" | "info" | "neutral"
}) {
  const toneClassName = {
    success: "bg-success-surface text-success-foreground ring-success/20",
    warning: "bg-warning-surface text-warning-foreground ring-warning/25",
    info: "bg-info-surface text-info-foreground ring-info/20",
    neutral: "bg-muted text-muted-foreground ring-border",
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
        </CardHeader>
      </Card>
    </motion.article>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function RoomGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="h-72 overflow-hidden rounded-xl border bg-muted/50">
          <div className="h-full animate-pulse bg-linear-to-r from-transparent via-white/50 to-transparent" />
        </div>
      ))}
    </div>
  )
}
