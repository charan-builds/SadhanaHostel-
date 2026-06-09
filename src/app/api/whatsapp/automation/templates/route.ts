import {
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { WhatsappAutomationService } from "@/services/whatsapp"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "whatsapp.automation.templates.list",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const dashboard = await service.getDashboard(getQueryParams(request))

      return successResponse(dashboard.templates, "WhatsApp templates loaded.")
    }
  )
}

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "whatsapp.automation.templates.save",
    },
    async () => {
      const service = await WhatsappAutomationService.create()
      const template = await service.saveTemplate(await parseJsonBody(request))

      return successResponse(template, "WhatsApp template saved.")
    }
  )
}
