import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.ledger",
    },
    async () => {
      const service = await PaymentsService.create()
      const ledger = await service.getResidentLedger(getQueryParams(request))

      return successResponse(ledger, "Payment ledger loaded.")
    }
  )
}
