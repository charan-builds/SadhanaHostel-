import {
  assertSameOriginMutation,
  errorResponse,
  getQueryParams,
  successResponse,
} from "@/lib/api"
import { revalidatePublicCmsContent } from "@/lib/cms/revalidate-public-cms"
import { WebsiteService } from "@/services/website.service"

export const dynamic = "force-dynamic"

type GalleryRouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, context: GalleryRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await WebsiteService.create()
    const item = await service.deleteGalleryItem({
      galleryItemId: id,
      organizationId: String(organizationId),
    })

    revalidatePublicCmsContent()

    return successResponse(item, "Gallery image removed successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
