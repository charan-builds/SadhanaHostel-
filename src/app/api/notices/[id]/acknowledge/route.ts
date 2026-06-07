import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { NoticesService } from "@/services/notices.service"

export const dynamic = "force-dynamic"

type NoticeAcknowledgeRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(
  request: Request,
  context: NoticeAcknowledgeRouteContext
) {
  return withApiRoute(
    request,
    {
      route: "notices.acknowledge",
    },
    async () => {
      const { id } = await context.params
      const service = await NoticesService.create()
      const notice = await service.acknowledgeNotice(
        id,
        await parseJsonBody(request)
      )

      return successResponse(notice, "Notice acknowledged.")
    }
  )
}
