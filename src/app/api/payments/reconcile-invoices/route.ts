import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.reconcile_invoices",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const service = await PaymentsService.create()
      const result = await service.reconcilePaymentInvoices(await parseJsonBody(request))

      return successResponse(result, "Payment invoice reconciliation completed.")
    }
  )
}
