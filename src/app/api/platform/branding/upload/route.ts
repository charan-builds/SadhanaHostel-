import {
  createdResponse,
  formDataToObject,
  getRequiredFile,
  parseMultipartForm,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { PlatformService } from "@/services/platform.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "platform.branding.upload",
      rateLimit: RATE_LIMIT_POLICIES.uploads,
    },
    async () => {
      const formData = await parseMultipartForm(request)
      const file = getRequiredFile(formData)
      const service = await PlatformService.create()
      const result = await service.uploadBrandingImage(formDataToObject(formData), file)

      return createdResponse(result, "Branding image uploaded successfully.")
    }
  )
}
