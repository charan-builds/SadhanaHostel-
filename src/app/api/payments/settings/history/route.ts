import {
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.settings.history",
    },
    async () => {
      const service = await PaymentsService.create()
      const settings = await service.listPaymentSettings(getQueryParams(request))

      return successResponse(settings, "Payment settings history loaded.")
    }
  )
}
