import { Building2 } from "lucide-react"

import type { MockResident, MockRoom } from "@/types/frontend"

type ResidentRoomSummaryProps = {
  resident: MockResident
  room?: MockRoom
}

export function ResidentRoomSummary({ resident, room }: ResidentRoomSummaryProps) {
  const occupancy = room
    ? `${room.occupiedCount}/${room.capacity} occupied`
    : "Occupancy not available"

  return (
    <section className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Room Summary</p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">{resident.roomNumber}</h2>
        </div>
        <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Building2 className="size-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</p>
          <p className="mt-1 text-sm font-medium capitalize">{room?.roomType ?? resident.residentType}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Floor</p>
          <p className="mt-1 text-sm font-medium">{room?.floorNumber ?? "Not assigned"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Occupancy</p>
          <p className="mt-1 text-sm font-medium">{occupancy}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Allocation Date
          </p>
          <p className="mt-1 text-sm font-medium">
            {resident.allocationDate ?? resident.joiningDate}
          </p>
        </div>
      </div>
    </section>
  )
}
