import {
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { LeavesService } from "@/services/leaves.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await LeavesService.create()
    const leaves = await service.listLeaves(getQueryParams(request))

    return successResponse(leaves, "Leave requests loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "leaves.create",
      rateLimit: RATE_LIMIT_POLICIES.leaveSubmit,
    },
    async () => {
      const service = await LeavesService.create()
      const leaveRequest = await service.createLeave(await parseJsonBody(request))

      return createdResponse(leaveRequest, "Leave request submitted.")
    }
  )
}
