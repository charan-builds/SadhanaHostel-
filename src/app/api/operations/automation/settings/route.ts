import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { assertNonProductionMutation } from "@/lib/operations/production-safety"
import {
  AutomationService,
  isDestructiveAutomationJobName,
} from "@/services/operations"
import { automationSettingsSchema } from "@/validations/operations.validation"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  return withApiRoute(request, { route: "operations.automation.settings" }, async () => {
    const values = automationSettingsSchema.parse(await parseJsonBody(request))

    if (isDestructiveAutomationJobName(values.name)) {
      assertNonProductionMutation("automation_destructive_job_settings", {
        dryRun: !values.enabled || values.dryRunOnly,
      })
    }

    const service = await AutomationService.create()
    const setting = await service.updateSettings(values)

    return successResponse(setting, "Automation setting updated.")
  })
}
