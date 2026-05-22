import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { PlatformService } from "@/services/platform.service"

export const dynamic = "force-dynamic"

type HostelRouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: HostelRouteContext) {
  return withApiRoute(request, { route: "platform.hostels.update" }, async () => {
    const { id } = await context.params
    const service = await PlatformService.create()
    const hostel = await service.updateHostel({
      ...(await parseJsonBody(request)),
      hostelId: id,
    })

    return successResponse(hostel, "Hostel updated successfully.")
  })
}
