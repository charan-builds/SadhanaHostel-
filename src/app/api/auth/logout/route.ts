import { errorResponse, successResponse } from "@/lib/api"
import { AuthService } from "@/services/auth.service"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const service = await AuthService.create()
    const result = await service.logout()

    return successResponse(result, "Logged out successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
