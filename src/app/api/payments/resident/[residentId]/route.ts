import { errorResponse, getQueryParams, successResponse } from "@/lib/api"
import { PaymentsService } from "@/services/payments.service"

export const dynamic = "force-dynamic"

type ResidentPaymentsRouteContext = {
  params: Promise<{ residentId: string }>
}

export async function GET(request: Request, context: ResidentPaymentsRouteContext) {
  try {
    const { residentId } = await context.params
    const query = getQueryParams(request)
    const service = await PaymentsService.create()
    const payments = await service.listPayments({
      ...query,
      residentId,
      organizationId: String(query.organizationId),
    })

    return successResponse(payments, "Resident payments loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}
