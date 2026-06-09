import {
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AdvanceLedgerService } from "@/services/advance-ledger"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "finance.advance_ledger.settlement",
    },
    async () => {
      const service = await AdvanceLedgerService.create()
      const settlement = await service.getSettlement(getQueryParams(request))

      return successResponse(settlement, "Advance settlement loaded.")
    }
  )
}
