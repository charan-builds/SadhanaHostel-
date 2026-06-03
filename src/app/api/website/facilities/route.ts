import { revalidateTag } from "next/cache"

import {
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { PUBLIC_CMS_CACHE_TAG } from "@/lib/cms/public-cms"
import { WebsiteService } from "@/services/website.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await WebsiteService.create()
    const facilities = await service.listFacilities(getQueryParams(request))

    return successResponse(facilities, "Facilities loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const service = await WebsiteService.create()
    const facility = await service.createFacility(await parseJsonBody(request))

    revalidateTag(PUBLIC_CMS_CACHE_TAG, { expire: 0 })

    return createdResponse(facility, "Facility created successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const service = await WebsiteService.create()
    const facility = await service.updateFacility(await parseJsonBody(request))

    revalidateTag(PUBLIC_CMS_CACHE_TAG, { expire: 0 })

    return successResponse(facility, "Facility updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
