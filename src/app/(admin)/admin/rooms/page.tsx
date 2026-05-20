import { BedDouble, Plus } from "lucide-react"

import { RoomFormDialog } from "@/components/admin/rooms/room-form-dialog"
import { RoomSummaryCards } from "@/components/admin/rooms/room-summary-cards"
import { RoomsTable } from "@/components/admin/rooms/rooms-table"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { Button } from "@/components/ui/button"
import { mockResidents, mockRooms } from "@/data/admin"

export default function AdminRoomsPage() {
  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Rooms"
        description="Manage hostel rooms, occupancy, resident allocations, and room availability."
        actions={
          <>
            <RoomFormDialog
              trigger={
                <Button type="button">
                  <Plus className="size-4" aria-hidden="true" />
                  Add Room
                </Button>
              }
            />
            <Button type="button" variant="outline">
              <BedDouble className="size-4" aria-hidden="true" />
              Room Allocation
            </Button>
          </>
        }
      />
      <RoomSummaryCards rooms={mockRooms} />
      <RoomsTable rooms={mockRooms} residents={mockResidents} />
    </ResponsiveContainer>
  )
}
