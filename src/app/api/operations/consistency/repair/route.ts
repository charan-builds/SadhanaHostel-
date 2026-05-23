import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { ConsistencyService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(request, { route: "operations.consistency.repair" }, async () => {
    const service = await ConsistencyService.create()
    const result = await service.repair(await parseJsonBody(request))

    return successResponse(result, "Consistency repair processed.")
  })
}
