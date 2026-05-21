import {
  createdResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "admissions.leads.list",
    },
    async () => {
      const service = await AdmissionsService.create()
      const leads = await service.listLeads(getQueryParams(request))

      return successResponse(leads, "Leads loaded.")
    }
  )
}

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "admissions.leads.create",
    },
    async () => {
      const service = await AdmissionsService.create()
      const lead = await service.createLead(await parseJsonBody(request))

      return createdResponse(lead, "Lead created.")
    }
  )
}
