import { revalidateTag } from "next/cache"

import {
  createdResponse,
  formDataToObject,
  getRequiredFile,
  parseMultipartForm,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { PUBLIC_CMS_CACHE_TAG } from "@/lib/cms/public-cms"
import { WebsiteService } from "@/services/website.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "website.gallery.upload",
      rateLimit: RATE_LIMIT_POLICIES.uploads,
    },
    async () => {
      const formData = await parseMultipartForm(request)
      const file = getRequiredFile(formData)
      const service = await WebsiteService.create()
      const result = await service.uploadGalleryImage(formDataToObject(formData), file)

      revalidateTag(PUBLIC_CMS_CACHE_TAG, { expire: 0 })

      return createdResponse(result, "Gallery image uploaded successfully.")
    }
  )
}
