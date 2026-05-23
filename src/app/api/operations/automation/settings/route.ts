import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { AutomationService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  return withApiRoute(request, { route: "operations.automation.settings" }, async () => {
    const service = await AutomationService.create()
    const setting = await service.updateSettings(await parseJsonBody(request))

    return successResponse(setting, "Automation setting updated.")
  })
}
