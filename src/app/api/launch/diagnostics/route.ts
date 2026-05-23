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
      route: "launch.diagnostics",
    },
    async () => {
      const service = await LaunchReadinessService.create()
      const diagnostics = await service.getDiagnostics(getQueryParams(request))

      return successResponse(diagnostics, "Launch diagnostics loaded.")
    }
  ).catch(errorResponse)
}
