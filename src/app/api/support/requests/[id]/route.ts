import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { SupportService } from "@/services/support.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  return withApiRoute(request, { route: "support.requests.update" }, async () => {
    const { id } = await context.params
    const service = await SupportService.create()
    const supportRequest = await service.updateRequest({
      ...(await parseJsonBody(request)),
      requestId: id,
    })

    return successResponse(supportRequest, "Support request updated.")
  })
}
