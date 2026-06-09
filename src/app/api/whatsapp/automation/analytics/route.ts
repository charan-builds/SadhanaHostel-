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
      route: "whatsapp.automation.analytics",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const analytics = await service.getAnalytics(getQueryParams(request))

      return successResponse(analytics, "WhatsApp analytics loaded.")
    }
  )
}
