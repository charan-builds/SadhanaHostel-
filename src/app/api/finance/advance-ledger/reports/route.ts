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
      route: "finance.advance_ledger.reports",
    },
    async () => {
      const service = await AdvanceLedgerService.create()
      const reports = await service.getReports(getQueryParams(request))
      const ownerDashboard = await service.getOwnerDashboard(getQueryParams(request))

      return successResponse(
        {
          reports,
          ownerDashboard,
        },
        "Advance reports loaded."
      )
    }
  )
}
