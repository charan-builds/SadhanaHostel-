import {
  errorResponse,
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { LaunchReadinessService } from "@/services/launch-readiness.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "launch.metrics",
    },
    async () => {
      const service = await LaunchReadinessService.create()
      const metrics = await service.getLaunchMetrics(getQueryParams(request))

      return successResponse(metrics, "Launch metrics loaded.")
    }
  ).catch(errorResponse)
}
