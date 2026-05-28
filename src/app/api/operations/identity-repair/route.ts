import {
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { IdentityReconciliationService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "operations.identity_repair.scan" }, async () => {
    const service = await IdentityReconciliationService.create()
    const report = await service.scan(getQueryParams(request))

    return successResponse(report, "Identity reconciliation report loaded.")
  })
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "operations.identity_repair.repair" }, async () => {
    const service = await IdentityReconciliationService.create()
    const result = await service.repair(await parseJsonBody(request))

    return successResponse(
      result,
      result.dryRun
        ? "Identity repair preview is ready."
        : "Identity repair completed."
    )
  })
}
