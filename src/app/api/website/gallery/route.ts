import {
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { WebsiteService } from "@/services/website.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await WebsiteService.create()
    const gallery = await service.listGallery(getQueryParams(request))

    return successResponse(gallery, "Gallery loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const service = await WebsiteService.create()
    const item = await service.createGalleryItem(await parseJsonBody(request))

    return createdResponse(item, "Gallery item created successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
