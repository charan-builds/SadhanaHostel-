import {
  createdResponse,
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { AdvanceLedgerService } from "@/services/advance-ledger"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "finance.advance_ledger.refunds.create",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const service = await AdvanceLedgerService.create()
      const refund = await service.requestRefund(await parseJsonBody(request))

      return createdResponse(refund, "Advance refund requested.")
    }
  )
}
