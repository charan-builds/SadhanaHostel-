import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { AutomationService } from "@/services/operations"
import { financeAutomationRunSchema } from "@/validations/finance.validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(request, { route: "finance.automation.run" }, async () => {
    const values = financeAutomationRunSchema.parse(await parseJsonBody(request))
    const service = await AutomationService.create()
    const result = await service.runFinanceSafe(values)

    return successResponse(result, "Finance automation job processed.")
  })
}
