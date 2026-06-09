import {
  parseJsonBody,
  RATE_LIMIT_POLICIES,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { StaffAccessService } from "@/services/staff-access.service"

export const dynamic = "force-dynamic"

type StaffUserRouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: StaffUserRouteContext) {
  return withApiRoute(
    request,
    {
      route: "staff_access.users.update",
      rateLimit: RATE_LIMIT_POLICIES.staffAccessWrite,
    },
    async () => {
      const { id } = await context.params
      const service = await StaffAccessService.create()
      const assignment = await service.updateStaff({
        ...(await parseJsonBody(request)),
        targetUserId: id,
      })

      return successResponse(assignment, "Staff access updated successfully.")
    }
  )
}
