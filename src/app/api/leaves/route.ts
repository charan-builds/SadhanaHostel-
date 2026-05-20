import {
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
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
  try {
    const service = await LeavesService.create()
    const leaveRequest = await service.createLeave(await parseJsonBody(request))

    return createdResponse(leaveRequest, "Leave request submitted.")
  } catch (error) {
    return errorResponse(error)
  }
}
