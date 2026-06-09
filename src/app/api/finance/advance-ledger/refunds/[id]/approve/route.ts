import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AdvanceLedgerService } from "@/services/advance-ledger"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiRoute(
    request,
    {
      route: "finance.advance_ledger.refunds.approve",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const { id } = await params
      const service = await AdvanceLedgerService.create()
      const refund = await service.approveRefund({
        ...(await parseJsonBody(request)),
        refundId: id,
      })

      return successResponse(refund, "Advance refund workflow updated.")
    }
  )
}
