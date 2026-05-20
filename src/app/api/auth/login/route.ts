import { errorResponse, parseJsonBody, successResponse } from "@/lib/api"
import { AuthService } from "@/services/auth.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const service = await AuthService.create()
    const session = await service.login(await parseJsonBody(request))

    return successResponse(session, "Logged in successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
