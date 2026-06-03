import { revalidateTag } from "next/cache"

import {
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
    const settings = await service.listSettings(getQueryParams(request))

    return successResponse(settings, "Website settings loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const service = await WebsiteService.create()
    const setting = await service.updateSetting(await parseJsonBody(request))

    revalidateTag(PUBLIC_CMS_CACHE_TAG, { expire: 0 })

    return successResponse(setting, "Website setting updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
