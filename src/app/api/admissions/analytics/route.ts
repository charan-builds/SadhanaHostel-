import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "admissions.analytics",
    },
    async () => {
      const service = await AdmissionsService.create()
      const analytics = await service.getAnalytics(getQueryParams(request))

      return successResponse(analytics, "Admissions analytics loaded.")
    }
  )
}
