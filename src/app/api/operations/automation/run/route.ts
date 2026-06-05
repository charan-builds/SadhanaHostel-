import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { assertNonProductionMutation } from "@/lib/operations/production-safety"
import {
  AutomationService,
  isDestructiveAutomationJobName,
} from "@/services/operations"
import { automationRunSchema } from "@/validations/operations.validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(request, { route: "operations.automation.run" }, async () => {
    const values = automationRunSchema.parse(await parseJsonBody(request))

    if (isDestructiveAutomationJobName(values.name)) {
      assertNonProductionMutation("automation_destructive_job", {
        dryRun: values.dryRun,
      })
    }

    const service = await AutomationService.create()
    const result = await service.run(values)

    return successResponse(result, "Automation job processed.")
  })
}
