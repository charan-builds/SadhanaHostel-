import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
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
      route: "admissions.reservations.convert",
    },
    async () => {
      const service = await AdmissionsService.create()
      const resident = await service.convertReservation({
        ...(await parseJsonBody(request)),
        reservationId: id,
      })

      return successResponse(resident, "Reservation converted to resident.")
    }
  )
}
