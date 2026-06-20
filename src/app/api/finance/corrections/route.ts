import {
  assertSameOriginMutation,
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { FinancialCorrectionsService } from "@/services/financial-corrections.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "finance.corrections.apply",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      assertSameOriginMutation(request)

      const service = await FinancialCorrectionsService.create()
      const correction = await service.applyCorrection(await parseJsonBody(request))

      return successResponse(correction, "Financial correction applied.")
    }
  )
}
