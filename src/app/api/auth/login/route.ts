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
      route: "auth.login",
      rateLimit: RATE_LIMIT_POLICIES.login,
    },
    async () => {
      const service = await AuthService.create()
      const session = await service.login(await parseJsonBody(request))

      return successResponse(session, "Logged in successfully.")
    }
  )
}
