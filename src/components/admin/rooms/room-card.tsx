import { Bath, BedDouble, Building2, IndianRupee, Users } from "lucide-react"

import { RoomActions } from "@/components/admin/rooms/room-actions"
import { RoomOccupancyBar, getRoomOccupancyPercent } from "@/components/admin/rooms/room-occupancy-bar"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MockResident, MockRoom } from "@/types/frontend"

type RoomCardProps = {
  room: MockRoom
  residents: MockResident[]
  onEdit?: () => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function RoomCard({ room, residents, onEdit }: RoomCardProps) {
  const availableBeds = Math.max(room.capacity - room.occupiedCount, 0)
  const occupancyPercent = getRoomOccupancyPercent(room.capacity, room.occupiedCount)
  const currentResidents = residents.filter((resident) =>
    room.currentResidentIds.includes(resident.id),
  )

  return (
    <article
      className={cn(
        "rounded-xl border bg-background p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md",
        room.status === "full" && "border-blue-200 bg-blue-50/30",
        room.status === "maintenance" && "border-amber-200 bg-amber-50/30",
        room.status === "inactive" && "bg-slate-50/70 opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{room.roomNumber}</h2>
            <StatusBadge status={room.status} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-4" aria-hidden="true" />
            {room.floorNumber}
          </p>
        </div>
        <Badge variant="secondary" className="h-7 capitalize">
          {room.roomType}
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BedDouble className="size-3.5" aria-hidden="true" />
            Capacity
          </p>
          <p className="mt-1 font-semibold text-foreground">
            {room.occupiedCount}/{room.capacity} beds
          </p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" aria-hidden="true" />
            Available
          </p>
          <p className="mt-1 font-semibold text-foreground">{availableBeds} beds</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <IndianRupee className="size-3.5" aria-hidden="true" />
            Monthly Fee
          </p>
          <p className="mt-1 font-semibold text-foreground">{formatCurrency(room.monthlyFee)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Bath className="size-3.5" aria-hidden="true" />
            Bathroom
          </p>
          <p className="mt-1 font-semibold text-foreground">
            {room.hasAttachedBathroom ? "Attached" : "Common"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Occupancy</span>
          <span className="text-muted-foreground">{occupancyPercent}%</span>
        </div>
        <RoomOccupancyBar capacity={room.capacity} occupiedCount={room.occupiedCount} />
      </div>

      <div className="mt-5 rounded-lg border bg-background p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Current Residents
        </p>
        {currentResidents.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {currentResidents.map((resident) => (
              <Badge key={resident.id} variant="outline" className="h-7">
                {resident.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No residents assigned in mock data.</p>
        )}
      </div>

      <div className="mt-5">
        <RoomActions room={room} context="card" onEdit={onEdit} />
      </div>
    </article>
  )
}
