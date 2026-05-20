import { errorResponse, getQueryParams, successResponse } from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await PaymentsService.create()
    const payments = await service.listPayments(getQueryParams(request))

    return successResponse(payments, "Payments loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}
