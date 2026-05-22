import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.reject",
    },
    async () => {
      const service = await PaymentsService.create()
      const payment = await service.rejectPayment(await parseJsonBody(request))

      return successResponse(payment, "Payment rejected.")
    }
  )
}
