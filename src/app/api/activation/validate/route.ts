import {
  RATE_LIMIT_POLICIES,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { ResidentInviteService } from "@/services/invites"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "activation.validate",
      rateLimit: RATE_LIMIT_POLICIES.inviteActivation,
    },
    async () => {
      const service = ResidentInviteService.createActivation()
      const invite = await service.validateInvite(await parseJsonBody(request))

      return successResponse(invite, "Invite validated.")
    }
  )
}
