import {
  createdResponse,
  errorResponse,
  parseJsonBody,
} from "@/lib/api"
import { RoomsService } from "@/services/rooms.service"

export const dynamic = "force-dynamic"

type RoomTransferRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RoomTransferRouteContext) {
  try {
    const { id } = await context.params
    const service = await RoomsService.create()
    const allocation = await service.transferRoom({
      ...(await parseJsonBody(request)),
      toRoomId: id,
    })

    return createdResponse(allocation, "Resident transferred successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
