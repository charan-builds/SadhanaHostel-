import { BedDouble, Building2, CheckCircle2, PauseCircle, Users, Wrench } from "lucide-react"

import { StatCard } from "@/components/shared/stat-card"
import type { MockRoom } from "@/types/frontend"

type RoomSummaryCardsProps = {
  rooms: MockRoom[]
}

export function RoomSummaryCards({ rooms }: RoomSummaryCardsProps) {
  const availableRooms = rooms.filter((room) => room.status === "available").length
  const fullRooms = rooms.filter((room) => room.status === "full").length
  const maintenanceRooms = rooms.filter((room) => room.status === "maintenance").length
  const totalCapacity = rooms.reduce((total, room) => total + room.capacity, 0)
  const occupiedBeds = rooms.reduce((total, room) => total + room.occupiedCount, 0)
  const inactiveRooms = rooms.filter((room) => room.status === "inactive").length

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        title="Total Rooms"
        value={rooms.length}
        description={`${inactiveRooms} inactive`}
        icon={Building2}
        tone="info"
      />
      <StatCard
        title="Available Rooms"
        value={availableRooms}
        description="Ready for allocation"
        icon={CheckCircle2}
        tone="success"
      />
      <StatCard
        title="Full Rooms"
        value={fullRooms}
        description="No beds available"
        icon={PauseCircle}
        tone="info"
      />
      <StatCard
        title="Maintenance Rooms"
        value={maintenanceRooms}
        description="Temporarily unavailable"
        icon={Wrench}
        tone="warning"
      />
      <StatCard
        title="Total Capacity"
        value={totalCapacity}
        description="Configured beds"
        icon={BedDouble}
        tone="default"
      />
      <StatCard
        title="Occupied Beds"
        value={occupiedBeds}
        description={`${Math.max(totalCapacity - occupiedBeds, 0)} beds open`}
        icon={Users}
        tone="success"
      />
    </section>
  )
}
