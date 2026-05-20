import {
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AuditService } from "@/services/audit"

export const dynamic = "force-dynamic"

type AuditRouteContext = {
  params: Promise<{ category: string }>
}

export async function GET(request: Request, context: AuditRouteContext) {
  const { category } = await context.params

  return withApiRoute(
    request,
    {
      route: `v1.audit.${category}`,
    },
    async () => {
      const service = await AuditService.create()
      const logs = await service.list(category, getQueryParams(request))

      return successResponse(logs, "Audit logs loaded.")
    }
  )
}
