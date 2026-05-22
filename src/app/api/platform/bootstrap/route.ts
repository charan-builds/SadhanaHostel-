import { createdResponse, parseJsonBody, withApiRoute } from "@/lib/api"
import { PlatformService } from "@/services/platform.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(request, { route: "platform.bootstrap" }, async () => {
    const service = await PlatformService.create()
    const result = await service.bootstrapTenant(await parseJsonBody(request))

    return createdResponse(result, "Hostel workspace created successfully.")
  })
}
