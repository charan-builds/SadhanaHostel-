import {
  assertSameOriginMutation,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { HostelRulesService } from "@/services/hostel-rules.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await HostelRulesService.create()
    const status = await service.getResidentRulesStatus(getQueryParams(request))

    return successResponse(status, "Resident hostel rules status loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request)

    const service = await HostelRulesService.create()
    const acceptance = await service.acceptCurrentRules(await parseJsonBody(request))

    return successResponse(acceptance, "Hostel rules accepted.")
  } catch (error) {
    return errorResponse(error)
  }
}
