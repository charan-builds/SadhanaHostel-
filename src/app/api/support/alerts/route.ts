import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { SupportService } from "@/services/support.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "support.alerts.list" }, async () => {
    const service = await SupportService.create()
    const alerts = await service.getOperationalAlerts(getQueryParams(request))

    return successResponse(alerts, "Operational alerts loaded.")
  })
}
