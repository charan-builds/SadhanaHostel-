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
      route: "payments.monthly_fee.generate",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const service = await PaymentsService.create()
      const feeRecord = await service.generateMonthlyFee(await parseJsonBody(request))

      return createdResponse(feeRecord, "Monthly due generated.")
    }
  )
}
