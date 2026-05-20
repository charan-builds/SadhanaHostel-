import { errorResponse, parseJsonBody, successResponse } from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const service = await PaymentsService.create()
    const payment = await service.verifyPayment(await parseJsonBody(request))

    return successResponse(payment, "Payment verified successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
