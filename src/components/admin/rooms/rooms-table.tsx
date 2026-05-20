"use client"

import { useMemo, useState } from "react"
import { Building2, LayoutGrid, TableProperties } from "lucide-react"

import { RoomActions } from "@/components/admin/rooms/room-actions"
import { RoomCard } from "@/components/admin/rooms/room-card"
import { RoomFormDialog } from "@/components/admin/rooms/room-form-dialog"
import { DataTableShell } from "@/components/shared/data-table-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { SearchAndFilterBar } from "@/components/shared/search-and-filter-bar"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import type { MockResident, MockRoom, RoomStatus, RoomType } from "@/types/frontend"

type RoomsTableProps = {
  rooms: MockRoom[]
  residents: MockResident[]
}

type ViewMode = "cards" | "table"
type RoomTypeFilter = "all" | RoomType
type RoomStatusFilter = "all" | RoomStatus
type BathroomFilter = "all" | "yes" | "no"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function RoomsTable({ rooms, residents }: RoomsTableProps) {
  const [searchValue, setSearchValue] = useState("")
  const [roomType, setRoomType] = useState<RoomTypeFilter>("all")
  const [roomStatus, setRoomStatus] = useState<RoomStatusFilter>("all")
  const [bathroom, setBathroom] = useState<BathroomFilter>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("cards")
  const [editingRoom, setEditingRoom] = useState<MockRoom | undefined>()
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const filteredRooms = useMemo(() => {
    const search = searchValue.trim().toLowerCase()

    return rooms.filter((room) => {
      const matchesSearch =
        search.length === 0 || room.roomNumber.toLowerCase().includes(search)
      const matchesType = roomType === "all" || room.roomType === roomType
      const matchesStatus = roomStatus === "all" || room.status === roomStatus
      const matchesBathroom =
        bathroom === "all" ||
        (bathroom === "yes" && room.hasAttachedBathroom) ||
        (bathroom === "no" && !room.hasAttachedBathroom)

      return matchesSearch && matchesType && matchesStatus && matchesBathroom
    })
  }, [bathroom, roomStatus, roomType, rooms, searchValue])

  function openEditDialog(room: MockRoom) {
    setEditingRoom(room)
    setEditDialogOpen(true)
  }

  return (
    <>
      <DataTableShell
        title="Room Inventory"
        description="Search, filter, and review room occupancy from mock frontend data."
      >
        <div className="border-b p-4">
          <SearchAndFilterBar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search by room number"
            filters={
              <>
                <Select value={roomType} onValueChange={(value) => setRoomType(value as RoomTypeFilter)}>
                  <SelectTrigger aria-label="Filter by room type" className="h-9 min-w-36">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={roomStatus}
                  onValueChange={(value) => setRoomStatus(value as RoomStatusFilter)}
                >
                  <SelectTrigger aria-label="Filter by room status" className="h-9 min-w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={bathroom} onValueChange={(value) => setBathroom(value as BathroomFilter)}>
                  <SelectTrigger aria-label="Filter by bathroom availability" className="h-9 min-w-44">
                    <SelectValue placeholder="Bathroom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All bathrooms</SelectItem>
                    <SelectItem value="yes">Attached bathroom</SelectItem>
                    <SelectItem value="no">Common bathroom</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <div className="flex rounded-lg border bg-background p-1">
                <Button
                  type="button"
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  aria-pressed={viewMode === "cards"}
                  className={cn(viewMode === "cards" && "shadow-sm")}
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  Cards
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  aria-pressed={viewMode === "table"}
                  className={cn(viewMode === "table" && "shadow-sm")}
                >
                  <TableProperties className="size-3.5" aria-hidden="true" />
                  Table
                </Button>
              </div>
            }
          />
        </div>

        {filteredRooms.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No rooms found"
            description="Try changing the search query or selected room filters."
          />
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                residents={residents}
                onEdit={() => openEditDialog(room)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Occupied</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Bathroom</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => {
                  const availableBeds = Math.max(room.capacity - room.occupiedCount, 0)

                  return (
                    <TableRow key={room.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{room.roomNumber}</p>
                          <p className="text-xs text-muted-foreground">{room.id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{room.roomType}</TableCell>
                      <TableCell>{room.floorNumber}</TableCell>
                      <TableCell>{room.capacity}</TableCell>
                      <TableCell>{room.occupiedCount}</TableCell>
                      <TableCell>{availableBeds}</TableCell>
                      <TableCell>{formatCurrency(room.monthlyFee)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="h-6">
                          {room.hasAttachedBathroom ? "Attached" : "Common"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={room.status} />
                      </TableCell>
                      <TableCell>
                        <RoomActions room={room} onEdit={() => openEditDialog(room)} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTableShell>

      <RoomFormDialog
        room={editingRoom}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditingRoom(undefined)
          }
        }}
      />
    </>
  )
}
