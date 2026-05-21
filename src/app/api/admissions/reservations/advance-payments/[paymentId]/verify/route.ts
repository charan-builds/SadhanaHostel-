import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ paymentId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { paymentId } = await context.params

  return withApiRoute(
    request,
    {
      route: "admissions.reservations.advance_payment.verify",
    },
    async () => {
      const service = await AdmissionsService.create()
      const payment = await service.verifyReservationPayment({
        ...(await parseJsonBody(request)),
        paymentId,
      })

      return successResponse(payment, "Reservation advance payment verified.")
    }
  )
}
