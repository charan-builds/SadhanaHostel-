import { getQueryParams, withApiRoute } from "@/lib/api"
import { AnalyticsService } from "@/services/analytics.service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "v1.analytics.owner.export",
    },
    async () => {
      const service = await AnalyticsService.create()
      const exportFile = await service.exportOwnerDashboard(getQueryParams(request))

      return new Response(exportFile.body, {
        headers: {
          "content-type": exportFile.contentType,
          "content-disposition": `attachment; filename="${exportFile.fileName}"`,
          "cache-control": "no-store",
        },
      })
    }
  )
}
