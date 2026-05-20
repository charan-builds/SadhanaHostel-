import {
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { RoomsService } from "@/services/rooms.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await RoomsService.create()
    const rooms = await service.listRooms(getQueryParams(request))

    return successResponse(rooms, "Rooms loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const service = await RoomsService.create()
    const room = await service.createRoom(await parseJsonBody(request))

    return createdResponse(room, "Room created successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
