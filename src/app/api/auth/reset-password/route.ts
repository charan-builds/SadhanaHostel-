import { errorResponse, parseJsonBody, successResponse } from "@/lib/api"
import { AuthService } from "@/services/auth.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const service = await AuthService.create()
    const result = await service.resetPassword(await parseJsonBody(request))

    return successResponse(result, "Password reset email requested.")
  } catch (error) {
    return errorResponse(error)
  }
}
