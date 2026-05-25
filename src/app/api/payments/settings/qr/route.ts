import {
  createdResponse,
  formDataToObject,
  getRequiredFile,
  parseMultipartForm,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { getClientIp } from "@/lib/rate-limit"
import { getRequestId } from "@/lib/tracing"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.settings.qr_upload",
      rateLimit: RATE_LIMIT_POLICIES.uploads,
    },
    async () => {
      const formData = await parseMultipartForm(request)
      const file = getRequiredFile(formData)
      const service = await PaymentsService.create()
      const result = await service.uploadPaymentQr(formDataToObject(formData), file, {
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        requestId: getRequestId(),
      })

      return createdResponse(result, "Payment QR uploaded.")
    }
  )
}
