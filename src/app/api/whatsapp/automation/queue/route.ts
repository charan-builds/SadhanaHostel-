import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { WhatsappAutomationService } from "@/services/whatsapp"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "whatsapp.automation.queue",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const queued = await service.queueEvent(await parseJsonBody(request))

      return successResponse(queued, "WhatsApp message queued.")
    }
  )
}
