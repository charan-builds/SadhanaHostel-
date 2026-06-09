import { removedRoomManagementRoute } from "@/lib/rooms/removed-room-management"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return removedRoomManagementRoute(request, "rooms.removed.transfer", "transfer")
}
