import { errorResponse, parseJsonBody, successResponse } from "@/lib/api"
import { LeavesService } from "@/services/leaves.service"

export const dynamic = "force-dynamic"

type LeaveReviewRouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: LeaveReviewRouteContext) {
  try {
    const { id } = await context.params
    const service = await LeavesService.create()
    const leaveRequest = await service.reviewLeave({
      ...(await parseJsonBody(request)),
      leaveRequestId: id,
      status: "approved",
    })

    return successResponse(leaveRequest, "Leave request approved.")
  } catch (error) {
    return errorResponse(error)
  }
}
