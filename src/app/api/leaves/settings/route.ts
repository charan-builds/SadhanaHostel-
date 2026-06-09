import {
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { LeavesService } from "@/services/leaves.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "leaves.settings" }, async () => {
    const service = await LeavesService.create()
    const settings = await service.getLeaveSettings(getQueryParams(request))

    return successResponse(settings, "Leave settings loaded.")
  })
}
