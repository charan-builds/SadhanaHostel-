import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { PlatformService } from "@/services/platform.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "platform.organization.get" }, async () => {
    const service = await PlatformService.create()
    const organization = await service.getOrganization()

    return successResponse(organization, "Organization loaded.")
  })
}

export async function PATCH(request: Request) {
  return withApiRoute(request, { route: "platform.organization.update" }, async () => {
    const service = await PlatformService.create()
    const organization = await service.updateOrganization(await parseJsonBody(request))

    return successResponse(organization, "Organization updated successfully.")
  })
}
