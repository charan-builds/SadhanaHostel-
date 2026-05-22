import {
  createdResponse,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { PlatformService } from "@/services/platform.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "platform.hostels.list" }, async () => {
    const service = await PlatformService.create()
    const hostels = await service.listHostels()

    return successResponse(hostels, "Hostels loaded.")
  })
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "platform.hostels.create" }, async () => {
    const service = await PlatformService.create()
    const hostel = await service.createHostel(await parseJsonBody(request))

    return createdResponse(hostel, "Hostel created successfully.")
  })
}
