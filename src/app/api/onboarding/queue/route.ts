import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { ResidentOnboardingService } from "@/services/onboarding/resident-onboarding.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "onboarding.queue" }, async () => {
    const service = await ResidentOnboardingService.create()
    const queue = await service.listVerificationQueue(getQueryParams(request))

    return successResponse(queue, "Onboarding queue loaded.")
  })
}
