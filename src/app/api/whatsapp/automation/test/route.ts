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
      route: "whatsapp.automation.test_send",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const result = await service.testSend(await parseJsonBody(request))

      return successResponse(result, "WhatsApp test send completed.")
    }
  )
}
