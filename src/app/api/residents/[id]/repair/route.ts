import {
  errorResponse,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { ResidentsService } from "@/services/residents.service"

export const dynamic = "force-dynamic"

type ResidentRepairRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: ResidentRepairRouteContext) {
  try {
    const { id } = await context.params
    const service = await ResidentsService.create()
    const result = await service.repairResidentLifecycle({
      ...(await parseJsonBody(request)),
      residentId: id,
    })

    return successResponse(result, "Resident lifecycle repair completed.")
  } catch (error) {
    return errorResponse(error)
  }
}
