import {
  createdResponse,
  errorResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
} from "@/lib/api"
import { ResidentsService } from "@/services/residents.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const service = await ResidentsService.create()
    const residents = await service.listResidents(getQueryParams(request))

    return successResponse(residents, "Residents loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const service = await ResidentsService.create()
    const resident = await service.createResident(await parseJsonBody(request))

    return createdResponse(resident, "Resident created successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
