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
      route: "finance.advance_ledger.get",
    },
    async () => {
      const service = await AdvanceLedgerService.create()
      const ledger = await service.getLedger(getQueryParams(request))

      return successResponse(ledger, "Advance ledger loaded.")
    }
  )
}
