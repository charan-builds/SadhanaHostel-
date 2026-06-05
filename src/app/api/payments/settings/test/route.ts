import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { assertNonProductionOperation } from "@/lib/operations/production-safety"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.settings.test",
    },
    async () => {
      const body = await parseJsonBody(request)

      assertNonProductionOperation("test_payment_generation")

      const service = await PaymentsService.create()
      const result = await service.testPaymentSettings(body)

      return successResponse(result, "Payment settings validation completed.")
    }
  )
}
