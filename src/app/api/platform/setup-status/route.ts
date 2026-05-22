import { successResponse, withApiRoute } from "@/lib/api"
import { PlatformService } from "@/services/platform.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "platform.setup_status" }, async () => {
    const service = await PlatformService.create()
    const status = await service.getSetupStatus()

    return successResponse(status, "Setup status loaded.")
  })
}
