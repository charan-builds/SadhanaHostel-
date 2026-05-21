import { createdResponse, parseJsonBody, withApiRoute } from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  return withApiRoute(
    request,
    {
      route: "admissions.reservations.advance_payment.create",
    },
    async () => {
      const service = await AdmissionsService.create()
      const payment = await service.createReservationPayment({
        ...(await parseJsonBody(request)),
        reservationId: id,
      })

      return createdResponse(payment, "Reservation advance payment recorded.")
    }
  )
}
