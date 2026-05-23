import {
  createdResponse,
  getQueryParams,
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { SupportService } from "@/services/support.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "support.requests.list" }, async () => {
    const service = await SupportService.create()
    const requests = await service.listRequests(getQueryParams(request))

    return successResponse(requests, "Support requests loaded.")
  })
}

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "support.requests.create",
      rateLimit: RATE_LIMIT_POLICIES.support,
    },
    async () => {
      const service = await SupportService.create()
      const result = await service.createRequest(await parseJsonBody(request))

      return createdResponse(
        result,
        result.reused
          ? "Existing recovery request found."
          : "Support request created."
      )
    }
  )
}
