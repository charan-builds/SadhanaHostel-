import {
  assertSameOriginMutation,
  errorResponse,
  getQueryParams,
  successResponse,
} from "@/lib/api"
import { ResidentsService } from "@/services/residents.service"

export const dynamic = "force-dynamic"

type ResidentPurgeRouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, context: ResidentPurgeRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await ResidentsService.create()
    const resident = await service.deleteResidentPermanently({
      residentId: id,
      organizationId: String(organizationId),
    })

    return successResponse(resident, "Resident and financial records deleted.")
  } catch (error) {
    return errorResponse(error)
  }
}
