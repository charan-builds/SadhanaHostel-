import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { NoticesService } from "@/services/notices.service"

export const dynamic = "force-dynamic"

type NoticeReadRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: NoticeReadRouteContext) {
  return withApiRoute(
    request,
    {
      route: "notices.mark_read",
      rateLimit: RATE_LIMIT_POLICIES.notificationStateWrite,
    },
    async () => {
      const { id } = await context.params
      const service = await NoticesService.create()
      const notice = await service.markNoticeRead(id, await parseJsonBody(request))

      return successResponse(notice, "Notice marked read.")
    }
  )
}
