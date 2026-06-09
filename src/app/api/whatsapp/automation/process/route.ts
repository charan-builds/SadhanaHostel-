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
      route: "whatsapp.automation.process",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const result = await service.processQueue(await parseJsonBody(request))

      return successResponse(result, "WhatsApp queue processed.")
    }
  )
}
