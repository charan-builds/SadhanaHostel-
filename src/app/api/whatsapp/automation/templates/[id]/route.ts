import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { WhatsappAutomationService } from "@/services/whatsapp"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(
    request,
    {
      route: "whatsapp.automation.templates.update",
    },
    async () => {
      const { id } = await params
      const service = await WhatsappAutomationService.create()
      const template = await service.saveTemplate({
        ...(await parseJsonBody(request)),
        templateId: id,
      })

      return successResponse(template, "WhatsApp template version saved.")
    }
  )
}
