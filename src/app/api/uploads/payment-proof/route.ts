import {
  createdResponse,
  formDataToObject,
  getRequiredFile,
  parseMultipartForm,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { UploadsService } from "@/services/uploads.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "uploads.payment_proof",
      rateLimit: RATE_LIMIT_POLICIES.uploads,
    },
    async () => {
      const formData = await parseMultipartForm(request)
      const file = getRequiredFile(formData)
      const service = await UploadsService.create()
      const result = await service.uploadPaymentProof(formDataToObject(formData), file)

      return createdResponse(result, "Payment proof uploaded successfully.")
    }
  )
}
