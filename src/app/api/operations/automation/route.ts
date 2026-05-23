import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { AutomationService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "operations.automation.dashboard" }, async () => {
    const service = await AutomationService.create()
    const dashboard = await service.getDashboard(getQueryParams(request))

    return successResponse(dashboard, "Automation dashboard loaded.")
  })
}
