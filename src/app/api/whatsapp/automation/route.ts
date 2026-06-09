import {
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { WhatsappAutomationService } from "@/services/whatsapp"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "whatsapp.automation.dashboard",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const dashboard = await service.getDashboard(getQueryParams(request))

      return successResponse(dashboard, "WhatsApp automation dashboard loaded.")
    }
  )
}
