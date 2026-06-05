import { getQueryParams, successResponse, withApiRoute } from "@/lib/api"
import { NotificationService } from "@/services/notifications"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "notifications.list",
    },
    async () => {
      const service = await NotificationService.create()
      const notifications = await service.listForCurrentUser(getQueryParams(request))

      return successResponse(notifications, "Notifications loaded.")
    }
  )
}
