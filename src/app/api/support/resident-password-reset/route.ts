import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { SupportService } from "@/services/support.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "support.resident_password_reset.request",
      rateLimit: RATE_LIMIT_POLICIES.passwordReset,
    },
    async () => {
      const service = SupportService.createPublic()
      const result = await service.createResidentPasswordResetRequest(
        await parseJsonBody(request)
      )

      return successResponse(result, "Password reset request received.")
    }
  )
}
