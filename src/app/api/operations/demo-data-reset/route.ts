import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { DemoDataResetService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    { route: "operations.demo-data-reset" },
    async () => {
      const service = await DemoDataResetService.create()
      const result = await service.reset(await parseJsonBody(request))

      return successResponse(
        result,
        result.dryRun
          ? "Demo/test data reset preview is ready."
          : "Demo/test resident data was reset safely."
      )
    }
  )
}
