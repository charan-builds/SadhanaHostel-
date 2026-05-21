import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "admissions.vacancy.public",
    },
    async () => {
      const service = AdmissionsService.createPublic()
      const vacancy = await service.getPublicVacancy(getQueryParams(request))

      return successResponse(vacancy, "Vacancy loaded.")
    }
  )
}
