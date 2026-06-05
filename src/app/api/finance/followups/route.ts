import {
  createdResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { FinanceFollowupsService } from "@/services/finance-followups.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "finance.followups.list" }, async () => {
    const service = await FinanceFollowupsService.create()
    const followups = await service.list(getQueryParams(request))

    return successResponse(followups, "Collection follow-ups loaded.")
  })
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "finance.followups.create" }, async () => {
    const service = await FinanceFollowupsService.create()
    const followup = await service.create(await parseJsonBody(request))

    return createdResponse(followup, "Collection follow-up saved.")
  })
}
