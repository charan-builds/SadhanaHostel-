import {
  createdResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { AdmissionsService } from "@/services/admissions.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "admissions.reservations.list",
    },
    async () => {
      const service = await AdmissionsService.create()
      const reservations = await service.listReservations(getQueryParams(request))

      return successResponse(reservations, "Reservations loaded.")
    }
  )
}

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "admissions.reservations.create",
    },
    async () => {
      const service = await AdmissionsService.create()
      const reservation = await service.createReservation(await parseJsonBody(request))

      return createdResponse(reservation, "Reservation created.")
    }
  )
}
