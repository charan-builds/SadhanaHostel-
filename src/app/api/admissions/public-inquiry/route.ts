import {
  createdResponse,
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "admissions.public_inquiry.create",
      rateLimit: RATE_LIMIT_POLICIES.passwordReset,
    },
    async () => {
      const service = AdmissionsService.createPublic()
      const lead = await service.createPublicInquiry(await parseJsonBody(request))

      return createdResponse(lead, "Inquiry received.")
    }
  )
}
