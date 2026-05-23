"use client"

import { useEffect, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, DoorOpen, Edit, Loader2, Plus, Search, UserPlus } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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

  if (!organizationId || !hostelId) {
    return (
      <EmptyState
        title="Hostel context missing"
        message="Your admin account needs an organization and hostel assignment before rooms can be managed."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <RoomMetric label="Rooms on page" value={rooms.length} />
        <RoomMetric label="Active rooms" value={activeRooms} />
        <RoomMetric label="Page capacity" value={totalCapacity} />
      </div>

      <Card>
        <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Room Inventory</CardTitle>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
          </div>

          {roomsQuery.isLoading ? (
            <RoomTableSkeleton />
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
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Monthly Fee</TableHead>
                    <TableHead>Facilities</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell>
                        <div className="font-medium">{room.room_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {[room.block_name, room.floor, room.room_name].filter(Boolean).join(" · ") ||
                            "No location label"}
                        </div>
                      </TableCell>
                      <TableCell>{humanizeEnum(room.room_type)}</TableCell>
                      <TableCell>{room.capacity}</TableCell>
                      <TableCell>{formatCurrency(room.base_monthly_fee)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[
                          room.has_attached_bathroom ? "Attached bath" : "Common bath",
                          room.has_ac ? "AC" : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={room.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setAllocatingRoom(room)}
                          >
                            <UserPlus className="size-4" aria-hidden="true" />
                            Allocate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setEditingRoom(room)
                              setIsRoomDialogOpen(true)
                            }}
                          >
                            <Edit className="size-4" aria-hidden="true" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
      monthlyFeeAmount: room?.base_monthly_fee ?? 0,
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
      monthlyFeeAmount: room?.base_monthly_fee ?? 0,
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
        bedLabel: values.bedLabel,
        transferDate: values.allocatedFrom,
        monthlyFeeAmount: values.monthlyFeeAmount || room.base_monthly_fee,
        reason: values.reason,
      })
      toast.success("Resident transferred.")
    } else {
      await allocateRoom.mutateAsync({
        organizationId,
        hostelId,
        roomId: room.id,
        residentId: values.residentId,
        bedLabel: values.bedLabel,
        allocatedFrom: values.allocatedFrom,
        monthlyFeeAmount: values.monthlyFeeAmount || room.base_monthly_fee,
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
              <FormField label="Bed label" error={form.formState.errors.bedLabel?.message}>
                <Input {...form.register("bedLabel")} placeholder="A, B, 1, 2" />
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
    baseMonthlyFee: room?.base_monthly_fee ?? 0,
    hasAttachedBathroom: room?.has_attached_bathroom ?? false,
    hasAc: room?.has_ac ?? false,
    status: room?.status ?? "active",
    description: room?.description ?? "",
  }
}

function RoomMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Building2 className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
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

function RoomTableSkeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="h-16 rounded-lg border bg-muted/50" />
      ))}
    </div>
  )
}
