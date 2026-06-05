import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { FinanceFollowupsService } from "@/services/finance-followups.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  return withApiRoute(request, { route: "finance.followups.complete" }, async () => {
    const [{ id }, body] = await Promise.all([context.params, parseJsonBody(request)])
    const service = await FinanceFollowupsService.create()
    const followup = await service.complete({
      ...body,
      followupId: id,
    })

    return successResponse(followup, "Collection follow-up completed.")
  })
}
