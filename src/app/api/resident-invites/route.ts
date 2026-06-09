import {
  createdResponse,
  getQueryParams,
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { ResidentInviteService } from "@/services/invites"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "resident_invites.list",
    },
    async () => {
      const service = await ResidentInviteService.create()
      const invites = await service.listResidentInvites(getQueryParams(request))

      return successResponse(invites, "Resident invites loaded.")
    }
  )
}

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "resident_invites.create",
      rateLimit: RATE_LIMIT_POLICIES.credentialIssuance,
    },
    async () => {
      const service = await ResidentInviteService.create()
      const invite = await service.createResidentInvite(await parseJsonBody(request))

      return createdResponse(invite, "Resident invite created.")
    }
  )
}
