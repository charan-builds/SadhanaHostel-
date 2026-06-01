import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { ResidentOnboardingService } from "@/services/onboarding/resident-onboarding.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(request, { route: "onboarding.submit" }, async () => {
    const service = await ResidentOnboardingService.create()
    const result = await service.submitForVerification(await parseJsonBody(request))

    return successResponse(result, "Onboarding completed.")
  })
}
