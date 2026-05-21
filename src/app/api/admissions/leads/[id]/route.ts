import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  return withApiRoute(
    request,
    {
      route: "admissions.leads.update",
    },
    async () => {
      const service = await AdmissionsService.create()
      const lead = await service.updateLead({
        ...(await parseJsonBody(request)),
        leadId: id,
      })

      return successResponse(lead, "Lead updated.")
    }
  )
}
