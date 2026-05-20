import { errorResponse, parseJsonBody, successResponse } from "@/lib/api"
import { NoticesService } from "@/services/notices.service"

export const dynamic = "force-dynamic"

type NoticeRouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: NoticeRouteContext) {
  try {
    const { id } = await context.params
    const service = await NoticesService.create()
    const notice = await service.updateNotice({
      ...(await parseJsonBody(request)),
      noticeId: id,
    })

    return successResponse(notice, "Notice updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
