import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { ConsistencyService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "operations.consistency.report" }, async () => {
    const service = await ConsistencyService.create()
    const report = await service.getReport(getQueryParams(request))

    return successResponse(report, "Consistency report loaded.")
  })
}
