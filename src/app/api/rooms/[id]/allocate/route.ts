import {
  createdResponse,
  errorResponse,
  parseJsonBody,
} from "@/lib/api"
import { RoomsService } from "@/services/rooms.service"

export const dynamic = "force-dynamic"

type RoomAllocationRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RoomAllocationRouteContext) {
  try {
    const { id } = await context.params
    const service = await RoomsService.create()
    const allocation = await service.allocateRoom({
      ...(await parseJsonBody(request)),
      roomId: id,
    })

    return createdResponse(allocation, "Room allocated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
