import { parseJsonBody, RATE_LIMIT_POLICIES, successResponse, withApiRoute } from "@/lib/api"
import { ResidentInviteService } from "@/services/invites"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  return withApiRoute(
    request,
    {
      route: "resident_invites.revoke",
      rateLimit: RATE_LIMIT_POLICIES.staffAccessWrite,
    },
    async () => {
      const service = await ResidentInviteService.create()
      const invite = await service.revokeResidentInvite({
        ...(await parseJsonBody(request)),
        inviteId: id,
      })

      return successResponse(invite, "Resident invite revoked.")
    }
  )
}
