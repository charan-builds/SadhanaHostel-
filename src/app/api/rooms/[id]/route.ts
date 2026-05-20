import {
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { RoomsService } from "@/services/rooms.service"

export const dynamic = "force-dynamic"

type RoomRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RoomRouteContext) {
  try {
    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await RoomsService.create()
    const room = await service.getRoom(id, String(organizationId))

    return successResponse(room, "Room loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RoomRouteContext) {
  try {
    const { id } = await context.params
    const service = await RoomsService.create()
    const room = await service.updateRoom({
      ...(await parseJsonBody(request)),
      roomId: id,
    })

    return successResponse(room, "Room updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
