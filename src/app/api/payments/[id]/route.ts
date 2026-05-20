import { errorResponse, getQueryParams, successResponse } from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

type PaymentRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: PaymentRouteContext) {
  try {
    const { id } = await context.params
    const { organizationId } = getQueryParams(request)
    const service = await PaymentsService.create()
    const payment = await service.getPayment(id, String(organizationId))

    return successResponse(payment, "Payment loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}
