import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AuthService } from "@/services/auth.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "auth.change_password",
      rateLimit: RATE_LIMIT_POLICIES.passwordReset,
    },
    async () => {
      const service = await AuthService.create()
      const session = await service.changePassword(await parseJsonBody(request))

      return successResponse(session, "Password updated successfully.")
    }
  )
}
