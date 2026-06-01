import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { ResidentsService } from "@/services/residents.service"

export const dynamic = "force-dynamic"

type ResidentResetPasswordRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(
  request: Request,
  context: ResidentResetPasswordRouteContext
) {
  return withApiRoute(
    request,
    {
      route: "residents.reset_password",
      rateLimit: RATE_LIMIT_POLICIES.passwordReset,
    },
    async () => {
      const { id } = await context.params
      const service = await ResidentsService.create()
      const result = await service.resetResidentTemporaryPassword({
        ...(await parseJsonBody(request)),
        residentId: id,
      })

      return successResponse(result, "Resident temporary password generated.")
    }
  )
}
