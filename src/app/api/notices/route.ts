import {
  assertSameOriginMutation,
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { NoticesService } from "@/services/notices.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await NoticesService.create()
    const notices = await service.listNotices(getQueryParams(request))

    return successResponse(notices, "Notices loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request)

    const service = await NoticesService.create()
    const notice = await service.createNotice(await parseJsonBody(request))

    return createdResponse(notice, "Notice created successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
