import {
  errorResponse,
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AnalyticsService } from "@/services/analytics.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "v1.analytics.dashboard",
    },
    async () => {
      const service = await AnalyticsService.create()
      const analytics = await service.getAdminDashboard(getQueryParams(request))

      return successResponse(analytics, "Dashboard analytics loaded.")
    }
  ).catch(errorResponse)
}
