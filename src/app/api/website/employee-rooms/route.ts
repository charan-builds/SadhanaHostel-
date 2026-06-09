import {
  assertSameOriginMutation,
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { revalidatePublicCmsContent } from "@/lib/cms/revalidate-public-cms"
import { WebsiteService } from "@/services/website.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await WebsiteService.create()
    const rooms = await service.listEmployeeAccommodationRooms(getQueryParams(request))

    return successResponse(rooms, "Employee accommodation rooms loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request)

    const service = await WebsiteService.create()
    const room = await service.createEmployeeAccommodationRoom(await parseJsonBody(request))

    revalidatePublicCmsContent()

    return createdResponse(room, "Employee accommodation room created successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOriginMutation(request)

    const service = await WebsiteService.create()
    const room = await service.updateEmployeeAccommodationRoom(await parseJsonBody(request))

    revalidatePublicCmsContent()

    return successResponse(room, "Employee accommodation room updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
