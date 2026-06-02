import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { SupportService } from "@/services/support.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  return withApiRoute(
    request,
    { route: "support.requests.publish_notice" },
    async () => {
      const { id } = await context.params
      const service = await SupportService.create()
      const result = await service.publishRequestAsNotice({
        ...(await parseJsonBody(request)),
        requestId: id,
      })

      return successResponse(result, "Resident report published as a notice.")
    }
  )
}
