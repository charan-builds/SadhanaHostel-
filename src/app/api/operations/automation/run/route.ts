import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { AutomationService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(request, { route: "operations.automation.run" }, async () => {
    const service = await AutomationService.create()
    const result = await service.run(await parseJsonBody(request))

    return successResponse(result, "Automation job processed.")
  })
}
