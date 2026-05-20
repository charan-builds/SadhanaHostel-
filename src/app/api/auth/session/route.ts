import { errorResponse, successResponse } from "@/lib/api"
import { AuthService } from "@/services/auth.service"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const service = await AuthService.create()
    const session = await service.getSessionOverview()

    return successResponse(session, "Session loaded.")
  } catch (error) {
    return errorResponse(error)
  }
}
