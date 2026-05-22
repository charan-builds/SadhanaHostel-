import {
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { getClientIp } from "@/lib/rate-limit"
import { getRequestId } from "@/lib/tracing"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.settings.get",
    },
    async () => {
      const query = getQueryParams(request)
      const service = await PaymentsService.create()
      const setting = await service.getActivePaymentSettings(query)

      return successResponse(setting, "Active payment settings loaded.")
    }
  )
}

export async function PATCH(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.settings.save",
    },
    async () => {
      const service = await PaymentsService.create()
      const setting = await service.savePaymentSettings(await parseJsonBody(request), {
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        requestId: getRequestId(),
      })

      return successResponse(setting, "Payment settings saved.")
    }
  )
}
