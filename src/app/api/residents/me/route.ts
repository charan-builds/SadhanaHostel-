import {
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { ResidentsService } from "@/services/residents.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "residents.me.get",
    },
    async () => {
      const service = await ResidentsService.create()
      const resident = await service.getCurrentResident(
        getQueryParams(request).organizationId
      )

      return successResponse(resident, "Resident profile loaded.")
    }
  )
}

export async function PATCH(request: Request) {
  return withApiRoute(
    request,
    {
      route: "residents.me.update",
    },
    async () => {
      const service = await ResidentsService.create()
      const resident = await service.updateCurrentResident(await parseJsonBody(request))

      return successResponse(resident, "Resident profile updated successfully.")
    }
  )
}
