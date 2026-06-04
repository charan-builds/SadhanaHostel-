import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { badRequest } from "@/lib/api/api-error"
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

export async function POST(request: Request, context: RouteContext) {
  return withApiRoute(request, { route: "support.requests.action" }, async () => {
    const { id } = await context.params
    const body = await parseJsonBody(request)
    const service = await SupportService.create()
    const action = typeof body.action === "string" ? body.action : null

    if (action === "approve_resident_password_reset") {
      const result = await service.approveResidentPasswordResetRequest({
        ...body,
        requestId: id,
      })

      return successResponse(result, "Resident temporary password generated.")
    }

    if (action === "publish_notice") {
      const result = await service.publishRequestAsNotice({
        ...body,
        requestId: id,
      })

      return successResponse(result, "Resident report published as a notice.")
    }

    throw badRequest("Unsupported support request action.")
  })
}
