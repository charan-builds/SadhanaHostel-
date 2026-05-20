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
      route: "payments.create",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const service = await PaymentsService.create()
      const payment = await service.createUpiPayment(await parseJsonBody(request))

      return createdResponse(payment, "UPI payment submitted for verification.")
    }
  )
}
