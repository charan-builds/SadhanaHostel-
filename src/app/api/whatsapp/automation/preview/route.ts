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
      route: "whatsapp.automation.preview",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const preview = await service.preview(await parseJsonBody(request))

      return successResponse(preview, "WhatsApp preview rendered.")
    }
  )
}
