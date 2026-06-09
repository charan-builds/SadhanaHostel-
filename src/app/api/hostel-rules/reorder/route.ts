import {
  assertSameOriginMutation,
  errorResponse,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { revalidatePublicCmsContent } from "@/lib/cms/revalidate-public-cms"
import { HostelRulesService } from "@/services/hostel-rules.service"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  try {
    assertSameOriginMutation(request)

    const service = await HostelRulesService.create()
    const rules = await service.reorderRules(await parseJsonBody(request))

    revalidatePublicCmsContent()

    return successResponse(rules, "Hostel rules reordered successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
