import { revalidateTag } from "next/cache"

import {
  errorResponse,
  getQueryParams,
  successResponse,
} from "@/lib/api"
import { PUBLIC_CMS_CACHE_TAG } from "@/lib/cms/public-cms"
import { WebsiteService } from "@/services/website.service"

export const dynamic = "force-dynamic"

type GalleryRouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, context: GalleryRouteContext) {
  try {
    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await WebsiteService.create()
    const item = await service.deleteGalleryItem({
      galleryItemId: id,
      organizationId: String(organizationId),
    })

    revalidateTag(PUBLIC_CMS_CACHE_TAG, { expire: 0 })

    return successResponse(item, "Gallery image removed successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
