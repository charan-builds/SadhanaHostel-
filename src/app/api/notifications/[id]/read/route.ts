import { parseJsonBody, RATE_LIMIT_POLICIES, successResponse, withApiRoute } from "@/lib/api"
import { NotificationService } from "@/services/notifications"

export const dynamic = "force-dynamic"

type NotificationReadRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: NotificationReadRouteContext) {
  return withApiRoute(
    request,
    {
      route: "notifications.mark_read",
      rateLimit: RATE_LIMIT_POLICIES.notificationStateWrite,
    },
    async () => {
      const { id } = await context.params
      const service = await NotificationService.create()
      const notification = await service.markRead(id, await parseJsonBody(request))

      return successResponse(notification, "Notification marked read.")
    }
  )
}
