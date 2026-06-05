import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { FinancialReconciliationService } from "@/services/operations"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    { route: "operations.financial_reconciliation.receipts" },
    async () => {
      const service = await FinancialReconciliationService.create()
      const result = await service.regenerateMissingReceipts(await parseJsonBody(request))

      return successResponse(result, "Missing receipt regeneration processed.")
    }
  )
}
