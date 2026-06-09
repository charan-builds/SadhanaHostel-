"use client"

import { useState, type FormEvent } from "react"
import {
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  UploadCloud,
} from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateEmployeeAccommodationRoom,
  useEmployeeAccommodationRooms,
  useUpdateEmployeeAccommodationRoom,
  useUploadGalleryImage,
} from "@/hooks"
import type { EmployeeAccommodationRoomView } from "@/sdk"

type RoomFormState = {
  title: string
  description: string
  capacity: string
  amenities: string
  sortOrder: string
  isVisible: boolean
}

const currentEmployeeRooms = ["Employee Room 1", "Employee Room 2", "Employee Room 3"] as const
const defaultEmployeeRoomAmenities = ["Food", "WiFi", "CCTV", "Water", "Parking support"]

const emptyRoomForm: RoomFormState = {
  title: "",
  description: "",
  capacity: "1",
  amenities: defaultEmployeeRoomAmenities.join("\n"),
  sortOrder: "0",
  isVisible: true,
}

export function EmployeeAccommodationGalleryManager({
  organizationId,
  hostelId,
}: {
  organizationId: string
  hostelId?: string
}) {
  const roomsQuery = useEmployeeAccommodationRooms({
    organizationId,
    hostelId,
    page: 1,
    pageSize: 100,
    includeHidden: true,
  })
  const createRoom = useCreateEmployeeAccommodationRoom()
  const updateRoom = useUpdateEmployeeAccommodationRoom()
  const uploadGalleryImage = useUploadGalleryImage()
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<EmployeeAccommodationRoomView | null>(null)
  const [roomForm, setRoomForm] = useState<RoomFormState>(emptyRoomForm)
  const [uploadRoom, setUploadRoom] = useState<EmployeeAccommodationRoomView | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const rooms = roomsQuery.data?.data ?? []
  const publishedRooms = rooms.filter((room) => room.status === "published" && room.is_visible)

  function openCreateRoom() {
    setEditingRoom(null)
    setRoomForm({
      ...emptyRoomForm,
      sortOrder: String(rooms.length),
    })
    setRoomDialogOpen(true)
  }

  function openEditRoom(room: EmployeeAccommodationRoomView) {
    setEditingRoom(room)
    setRoomForm({
      title: room.title,
      description: room.description ?? "",
      capacity: String(room.capacity),
      amenities: room.amenities.join("\n"),
      sortOrder: String(room.sort_order),
      isVisible: room.is_visible && room.status === "published",
    })
    setRoomDialogOpen(true)
  }

  function openUploadRoom(room: EmployeeAccommodationRoomView) {
    setUploadRoom(room)
    setSelectedFiles([])
    setUploadProgress(null)
  }

  async function handleSaveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = {
      organizationId,
      hostelId,
      title: roomForm.title,
      description: roomForm.description || undefined,
      capacity: Number(roomForm.capacity),
      amenities: parseAmenities(roomForm.amenities),
      sortOrder: Number(roomForm.sortOrder),
      isVisible: roomForm.isVisible,
      status: roomForm.isVisible ? "published" as const : "draft" as const,
    }

    try {
      if (editingRoom) {
        await updateRoom.mutateAsync({
          ...payload,
          roomId: editingRoom.id,
        })
        toast.success("Employee room updated.")
      } else {
        await createRoom.mutateAsync(payload)
        toast.success("Employee room added.")
      }

      setRoomDialogOpen(false)
      setEditingRoom(null)
      setRoomForm(emptyRoomForm)
      await roomsQuery.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee room could not be saved.")
    }
  }

  async function handleToggleVisibility(room: EmployeeAccommodationRoomView) {
    try {
      const nextVisible = !(room.is_visible && room.status === "published")

      await updateRoom.mutateAsync({
        organizationId,
        hostelId,
        roomId: room.id,
        title: room.title,
        description: room.description ?? undefined,
        capacity: room.capacity,
        amenities: room.amenities,
        sortOrder: room.sort_order,
        isVisible: nextVisible,
        status: nextVisible ? "published" : "draft",
      })
      toast.success(nextVisible ? "Employee room is visible." : "Employee room hidden.")
      await roomsQuery.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Visibility could not be changed.")
    }
  }

  async function handleCreateCurrentRooms() {
    const existingTitles = new Set(rooms.map((room) => room.title.toLowerCase()))
    const missingRooms = currentEmployeeRooms.filter(
      (title) => !existingTitles.has(title.toLowerCase())
    )

    if (missingRooms.length === 0) {
      toast.info("Current employee rooms are already added.")
      return
    }

    try {
      for (const [index, title] of missingRooms.entries()) {
        await createRoom.mutateAsync({
          organizationId,
          hostelId,
          title,
          description: "Employee accommodation room for working professional residents.",
          capacity: 1,
          amenities: defaultEmployeeRoomAmenities,
          sortOrder: rooms.length + index,
          isVisible: false,
          status: "draft",
        })
      }

      toast.success(`${missingRooms.length} employee room${missingRooms.length === 1 ? "" : "s"} added.`)
      await roomsQuery.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Current employee rooms could not be added.")
    }
  }

  async function handleUploadImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!uploadRoom) {
      return
    }

    if (selectedFiles.length === 0) {
      toast.error("Choose at least one employee room image.")
      return
    }

    setUploadProgress(0)

    try {
      for (const [index, file] of selectedFiles.entries()) {
        const title =
          selectedFiles.length === 1
            ? uploadRoom.title
            : `${uploadRoom.title} ${uploadRoom.images.length + index + 1}`

        await uploadGalleryImage.mutateAsync({
          file,
          input: {
            organizationId,
            hostelId,
            title,
            description: uploadRoom.description ?? undefined,
            category: uploadRoom.imageCategory,
            altText: `${uploadRoom.title} employee accommodation room photo`,
            sortOrder: uploadRoom.images.length + index,
            status: "published",
          },
          options: {
            onProgress: (progress) =>
              setUploadProgress(
                Math.round(((index + progress.percent / 100) / selectedFiles.length) * 100)
              ),
          },
        })
      }

      toast.success(`${selectedFiles.length} room image${selectedFiles.length === 1 ? "" : "s"} uploaded.`)
      setSelectedFiles([])
      setUploadProgress(null)
      setUploadRoom(null)
      await roomsQuery.refetch()
    } catch (error) {
      setUploadProgress(null)
      toast.error(error instanceof Error ? error.message : "Employee room images could not be uploaded.")
    }
  }

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader className="gap-3 md:grid md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Employee Accommodation Gallery Management</CardTitle>
            <CardDescription>
              Manage employee rooms, room metadata, display order, visibility, and room-specific photos.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button type="button" variant="outline" onClick={handleCreateCurrentRooms}>
              <Plus className="size-4" aria-hidden="true" />
              Add current rooms
            </Button>
            <Button type="button" onClick={openCreateRoom}>
              <Plus className="size-4" aria-hidden="true" />
              Add room
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <EmployeeRoomMetric label="Rooms" value={rooms.length} />
            <EmployeeRoomMetric label="Visible" value={publishedRooms.length} />
            <EmployeeRoomMetric
              label="Images"
              value={rooms.reduce((total, room) => total + room.images.length, 0)}
            />
          </div>
        </CardContent>
      </Card>

      {roomsQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-lg border bg-muted/50" />
          ))}
        </div>
      ) : roomsQuery.isError ? (
        <APIErrorState
          title="Employee rooms could not be loaded"
          error={roomsQuery.error}
          onRetry={() => void roomsQuery.refetch()}
        />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="No employee rooms yet"
          message="Add Employee Room 1, 2, and 3, then upload public photos for each room."
          action={<Button onClick={handleCreateCurrentRooms}>Add current rooms</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article key={room.id} className="overflow-hidden rounded-lg border bg-background shadow-sm">
              <div className="relative aspect-video bg-muted">
                {room.images[0]?.imageUrl ? (
                  <div
                    role="img"
                    aria-label={room.images[0].alt_text ?? room.title}
                    className="size-full bg-cover bg-center"
                    style={{ backgroundImage: `url("${room.images[0].imageUrl}")` }}
                  />
                ) : (
                  <div className="grid size-full place-items-center">
                    <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <StatusBadge status={room.status} />
                  {room.is_visible ? <Badge variant="secondary">Visible</Badge> : <Badge variant="outline">Hidden</Badge>}
                </div>
              </div>
              <div className="grid gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{room.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {room.description ?? "No description yet."}
                    </p>
                  </div>
                  <Badge variant="outline">Order {room.sort_order}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <MiniStat label="Capacity" value={room.capacity} />
                  <MiniStat label="Amenities" value={room.amenities.length} />
                  <MiniStat label="Images" value={room.images.length} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {room.amenities.slice(0, 6).map((amenity) => (
                    <Badge key={amenity} variant="outline">
                      {amenity}
                    </Badge>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <Button type="button" variant="outline" onClick={() => openEditRoom(room)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openUploadRoom(room)}>
                    <UploadCloud className="size-4" aria-hidden="true" />
                    Images
                  </Button>
                  <Button
                    type="button"
                    variant={room.is_visible && room.status === "published" ? "destructive" : "outline"}
                    onClick={() => void handleToggleVisibility(room)}
                    disabled={updateRoom.isPending}
                  >
                    {room.is_visible && room.status === "published" ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                    {room.is_visible && room.status === "published" ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSaveRoom}>
            <DialogHeader>
              <DialogTitle>{editingRoom ? "Edit employee room" : "Add employee room"}</DialogTitle>
              <DialogDescription>
                This metadata appears in the public employee accommodation section.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="employee-room-title">Room title</Label>
                <Input
                  id="employee-room-title"
                  required
                  value={roomForm.title}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employee-room-description">Description</Label>
                <Textarea
                  id="employee-room-description"
                  value={roomForm.description}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="employee-room-capacity">Capacity</Label>
                  <Input
                    id="employee-room-capacity"
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={roomForm.capacity}
                    onChange={(event) =>
                      setRoomForm((current) => ({ ...current, capacity: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="employee-room-order">Display order</Label>
                  <Input
                    id="employee-room-order"
                    type="number"
                    min={0}
                    required
                    value={roomForm.sortOrder}
                    onChange={(event) =>
                      setRoomForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                  />
                </div>
                <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={roomForm.isVisible}
                    onChange={(event) =>
                      setRoomForm((current) => ({ ...current, isVisible: event.target.checked }))
                    }
                  />
                  Visible
                </label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employee-room-amenities">Amenities</Label>
                <Textarea
                  id="employee-room-amenities"
                  value={roomForm.amenities}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, amenities: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Enter one amenity per line or separate amenities with commas.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createRoom.isPending || updateRoom.isPending}>
                {createRoom.isPending || updateRoom.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Save room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(uploadRoom)}
        onOpenChange={(open) => {
          if (!open) {
            setUploadRoom(null)
            setSelectedFiles([])
            setUploadProgress(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleUploadImages}>
            <DialogHeader>
              <DialogTitle>Upload employee room images</DialogTitle>
              <DialogDescription>
                {uploadRoom ? `Images will be attached to ${uploadRoom.title}.` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="employee-room-images">Images</Label>
                <Input
                  id="employee-room-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) =>
                    setSelectedFiles(Array.from(event.target.files ?? []))
                  }
                />
                {selectedFiles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected.
                  </p>
                ) : null}
              </div>
              {uploadProgress !== null ? (
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={uploadGalleryImage.isPending}>
                {uploadGalleryImage.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UploadCloud className="size-4" aria-hidden="true" />
                )}
                Publish images
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function EmployeeRoomMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function parseAmenities(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}
