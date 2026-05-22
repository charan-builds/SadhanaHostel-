import {
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { ResidentOnboardingService } from "@/services/onboarding/resident-onboarding.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "onboarding.me.get" }, async () => {
    const service = await ResidentOnboardingService.create()
    const result = await service.getCurrentStatus(getQueryParams(request))

    return successResponse(result, "Onboarding status loaded.")
  })
}

export async function PATCH(request: Request) {
  return withApiRoute(request, { route: "onboarding.me.update" }, async () => {
    const service = await ResidentOnboardingService.create()
    const result = await service.updateProfile(await parseJsonBody(request))

    return successResponse(result, "Onboarding profile saved.")
  })
}
