import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.settings.test",
    },
    async () => {
      const service = await PaymentsService.create()
      const result = await service.testPaymentSettings(await parseJsonBody(request))

      return successResponse(result, "Payment settings validation completed.")
    }
  )
}
