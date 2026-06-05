import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { assertNonProductionMutation } from "@/lib/operations/production-safety"
import { ConsistencyService } from "@/services/operations"
import { consistencyRepairSchema } from "@/validations/operations.validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(request, { route: "operations.consistency.repair" }, async () => {
    const values = consistencyRepairSchema.parse(await parseJsonBody(request))

    assertNonProductionMutation("consistency_repair", { dryRun: values.dryRun })

    const service = await ConsistencyService.create()
    const result = await service.repair(values)

    return successResponse(result, "Consistency repair processed.")
  })
}
