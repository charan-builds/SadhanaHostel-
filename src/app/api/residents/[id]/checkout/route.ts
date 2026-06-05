import {
  assertSameOriginMutation,
  errorResponse,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { ResidentsService } from "@/services/residents.service"

export const dynamic = "force-dynamic"

type ResidentCheckoutRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: ResidentCheckoutRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const service = await ResidentsService.create()
    const resident = await service.checkoutResident({
      ...(await parseJsonBody(request)),
      residentId: id,
    })

    return successResponse(resident, "Resident checked out successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
