import {
  createdResponse,
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.record_in_person",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const service = await PaymentsService.create()
      const payment = await service.recordInPersonPayment(await parseJsonBody(request))

      return createdResponse(payment, "In-person payment recorded.")
    }
  )
}
