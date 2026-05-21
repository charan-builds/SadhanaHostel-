import { createdResponse, parseJsonBody, withApiRoute } from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  return withApiRoute(
    request,
    {
      route: "admissions.leads.notes.create",
    },
    async () => {
      const service = await AdmissionsService.create()
      const note = await service.addLeadNote({
        ...(await parseJsonBody(request)),
        leadId: id,
      })

      return createdResponse(note, "Lead note added.")
    }
  )
}
