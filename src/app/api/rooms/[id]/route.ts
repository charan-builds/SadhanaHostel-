import { removedRoomManagementRoute } from "@/lib/rooms/removed-room-management"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return removedRoomManagementRoute(request, "rooms.removed.get")
}

export async function PATCH(request: Request) {
  return removedRoomManagementRoute(request, "rooms.removed.update")
}
