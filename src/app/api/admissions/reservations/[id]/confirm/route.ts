import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  return withApiRoute(
    request,
    {
      route: "admissions.reservations.confirm",
    },
    async () => {
      const service = await AdmissionsService.create()
      const reservation = await service.confirmReservation({
        ...(await parseJsonBody(request)),
        reservationId: id,
      })

      return successResponse(reservation, "Reservation confirmed.")
    }
  )
}
