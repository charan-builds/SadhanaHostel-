import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AdvanceLedgerService } from "@/services/advance-ledger"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "finance.advance_ledger.allocate",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const service = await AdvanceLedgerService.create()
      const result = await service.allocateAvailableAdvance(await parseJsonBody(request))

      return successResponse(result, "Advance allocation completed.")
    }
  )
}
