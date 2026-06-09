import { parseJsonBody, RATE_LIMIT_POLICIES, successResponse, withApiRoute } from "@/lib/api"
import { SupportService } from "@/services/support.service"

export const dynamic = "force-dynamic"

type SupportPasswordResetRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: SupportPasswordResetRouteContext) {
  return withApiRoute(
    request,
    {
      route: "support.requests.resident_password_reset.approve",
      rateLimit: RATE_LIMIT_POLICIES.credentialIssuance,
    },
    async () => {
      const { id } = await context.params
      const service = await SupportService.create()
      const result = await service.approveResidentPasswordResetRequest({
        ...(await parseJsonBody(request)),
        requestId: id,
      })

      return successResponse(result, "Resident temporary password generated.")
    }
  )
}
