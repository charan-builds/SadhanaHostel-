import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { assertNonProductionOperation } from "@/lib/operations/production-safety"
import { DemoDataResetService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    { route: "operations.demo-data-reset" },
    async () => {
      const body = await parseJsonBody(request)

      assertNonProductionOperation("demo_data_reset")

      const service = await DemoDataResetService.create()
      const result = await service.reset(body)

      return successResponse(
        result,
        result.dryRun
          ? "Demo/test data reset preview is ready."
          : "Demo/test resident data was reset safely."
      )
    }
  )
}
