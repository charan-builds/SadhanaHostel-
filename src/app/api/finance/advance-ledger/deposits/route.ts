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
      route: "finance.advance_ledger.deposits.create",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const service = await AdvanceLedgerService.create()
      const deposit = await service.recordDeposit(await parseJsonBody(request))

      return createdResponse(deposit, "Advance deposit recorded.")
    }
  )
}
