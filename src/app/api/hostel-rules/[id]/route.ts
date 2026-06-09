import {
  assertSameOriginMutation,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { revalidatePublicCmsContent } from "@/lib/cms/revalidate-public-cms"
import { HostelRulesService } from "@/services/hostel-rules.service"

export const dynamic = "force-dynamic"

type HostelRuleRouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: HostelRuleRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const service = await HostelRulesService.create()
    const rule = await service.updateRule({
      ...(await parseJsonBody(request)),
      ruleId: id,
    })

    revalidatePublicCmsContent()

    return successResponse(rule, "Hostel rule updated successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: HostelRuleRouteContext) {
  try {
    assertSameOriginMutation(request)

    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await HostelRulesService.create()
    const rule = await service.deleteRule({
      ruleId: id,
      organizationId: String(organizationId),
    })

    revalidatePublicCmsContent()

    return successResponse(rule, "Hostel rule deleted successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
