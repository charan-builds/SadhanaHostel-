import {
  getQueryParams,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { UploadsService } from "@/services/uploads.service"

export const dynamic = "force-dynamic"

type PaymentProofRouteContext = {
  params: Promise<{ paymentId: string }>
}

export async function GET(request: Request, context: PaymentProofRouteContext) {
  return withApiRoute(
    request,
    {
      route: "uploads.payment_proof.preview",
      rateLimit: RATE_LIMIT_POLICIES.uploads,
    },
    async () => {
      const { paymentId } = await context.params
      const service = await UploadsService.create()
      const result = await service.getPaymentProofSignedUrl({
        ...getQueryParams(request),
        paymentId,
      })

      return successResponse(result, "Payment proof preview URL created.")
    }
  )
}
