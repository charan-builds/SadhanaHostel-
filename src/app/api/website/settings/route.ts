import {
  assertSameOriginMutation,
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
    const settings = await service.listSettings(getQueryParams(request))

    return successResponse(settings, "Website settings loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOriginMutation(request)

    const service = await WebsiteService.create()
    const setting = await service.updateSetting(await parseJsonBody(request))

    revalidatePublicCmsContent()

    return successResponse(setting, "Website setting updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
