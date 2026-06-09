import {
  assertSameOriginMutation,
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { revalidatePublicCmsContent } from "@/lib/cms/revalidate-public-cms"
import { HostelRulesService } from "@/services/hostel-rules.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await HostelRulesService.create()
    const rules = await service.listRules(getQueryParams(request))

    return successResponse(rules, "Hostel rules loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request)

    const service = await HostelRulesService.create()
    const rule = await service.createRule(await parseJsonBody(request))

    revalidatePublicCmsContent()

    return createdResponse(rule, "Hostel rule created successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
