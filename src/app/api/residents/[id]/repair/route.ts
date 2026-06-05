import {
  assertSameOriginMutation,
  errorResponse,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { assertNonProductionMutation } from "@/lib/operations/production-safety"
import { ResidentsService } from "@/services/residents.service"
import { repairResidentLifecycleSchema } from "@/validations/resident.validation"

export const dynamic = "force-dynamic"

type ResidentRepairRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: ResidentRepairRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const values = repairResidentLifecycleSchema.parse({
      ...(await parseJsonBody(request)),
      residentId: id,
    })

    assertNonProductionMutation("resident_lifecycle_repair", {
      dryRun: values.dryRun,
    })

    const service = await ResidentsService.create()
    const result = await service.repairResidentLifecycle(values)

    return successResponse(result, "Resident lifecycle repair completed.")
  } catch (error) {
    return errorResponse(error)
  }
}
