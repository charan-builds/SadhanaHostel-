import {
  getQueryParams,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { SearchService } from "@/services/search"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "v1.search",
      rateLimit: RATE_LIMIT_POLICIES.search,
    },
    async () => {
      const service = await SearchService.create()
      const results = await service.search(getQueryParams(request))

      return successResponse(results, "Search results loaded.")
    }
  )
}
