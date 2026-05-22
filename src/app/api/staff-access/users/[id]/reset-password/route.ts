import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { StaffAccessService } from "@/services/staff-access.service"

export const dynamic = "force-dynamic"

type StaffUserRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: StaffUserRouteContext) {
  return withApiRoute(
    request,
    { route: "staff_access.users.reset_password" },
    async () => {
      const { id } = await context.params
      const service = await StaffAccessService.create()
      const result = await service.resetTemporaryPassword({
        ...(await parseJsonBody(request)),
        targetUserId: id,
      })

      return successResponse(result, "Temporary password generated.")
    }
  )
}
