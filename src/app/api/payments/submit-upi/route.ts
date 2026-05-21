import {
  createdResponse,
  formDataToObject,
  getRequiredFile,
  parseMultipartForm,
  RATE_LIMIT_POLICIES,
  withApiRoute,
} from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "payments.submit_upi",
      rateLimit: RATE_LIMIT_POLICIES.paymentCreate,
    },
    async () => {
      const formData = await parseMultipartForm(request)
      const proofFile = getRequiredFile(formData)
      const service = await PaymentsService.create()
      const payment = await service.submitUpiPaymentWithProof(
        formDataToObject(formData),
        proofFile
      )

      return createdResponse(payment, "Payment proof submitted for admin verification.")
    }
  )
}
