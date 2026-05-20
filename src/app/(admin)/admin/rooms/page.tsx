import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminRoomsPage() {
  return (
    <WorkspacePage
      title="Rooms"
      description="Buildings, floors, room inventory, bed allocation, pricing, and occupancy state."
      metrics={[
        { label: "Rooms", value: "0", detail: "Total configured rooms." },
        { label: "Beds", value: "0", detail: "Bed-level inventory for allocation." },
        { label: "Vacant", value: "0", detail: "Available beds after assignments." },
      ]}
      workItems={[
        {
          title: "Room hierarchy",
          description: "Model hostel, block, floor, room, and bed as separate scalable entities.",
          status: "Schema",
        },
        {
          title: "Allocation history",
          description: "Track moves and checkout history instead of overwriting assignments.",
          status: "Planned",
        },
      ]}
    />
  )
}
