import {
  RATE_LIMIT_POLICIES,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AuthService } from "@/services/auth.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "auth.resident_phone_otp.request",
      rateLimit: RATE_LIMIT_POLICIES.login,
    },
    async () => {
      const service = await AuthService.create()
      const result = await service.requestResidentPhoneOtp(await parseJsonBody(request))

      return successResponse(result, "OTP sent if resident access is active.")
    }
  )
}
