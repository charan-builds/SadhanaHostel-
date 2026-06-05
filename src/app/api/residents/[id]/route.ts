import {
  assertSameOriginMutation,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { ResidentsService } from "@/services/residents.service"

export const dynamic = "force-dynamic"

type ResidentRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: ResidentRouteContext) {
  try {
    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await ResidentsService.create()
    const resident = await service.getResident(id, String(organizationId))

    return successResponse(resident, "Resident loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: ResidentRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const service = await ResidentsService.create()
    const resident = await service.updateResident({
      ...(await parseJsonBody(request)),
      residentId: id,
    })

    return successResponse(resident, "Resident updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: ResidentRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await ResidentsService.create()
    const resident = await service.deactivateResident({
      residentId: id,
      organizationId: String(organizationId),
    })

    return successResponse(resident, "Resident deactivated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
