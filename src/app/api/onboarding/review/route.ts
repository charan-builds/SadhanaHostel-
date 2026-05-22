import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { ResidentOnboardingService } from "@/services/onboarding/resident-onboarding.service"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  return withApiRoute(request, { route: "onboarding.review" }, async () => {
    const service = await ResidentOnboardingService.create()
    const result = await service.review(await parseJsonBody(request))

    return successResponse(result, "Resident onboarding reviewed.")
  })
}
