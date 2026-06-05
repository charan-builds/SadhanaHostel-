import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { FinanceDashboardService } from "@/services/finance-dashboard.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "finance.dashboard",
    },
    async () => {
      const service = await FinanceDashboardService.create()
      const dashboard = await service.getDashboard(getQueryParams(request))

      return successResponse(dashboard, "Finance dashboard loaded.")
    }
  )
}
