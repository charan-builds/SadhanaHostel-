import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { NotificationService } from "@/services/notifications"

export const dynamic = "force-dynamic"

type NotificationArchiveRouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: NotificationArchiveRouteContext) {
  return withApiRoute(
    request,
    {
      route: "notifications.archive",
    },
    async () => {
      const { id } = await context.params
      const service = await NotificationService.create()
      const notification = await service.archive(id, await parseJsonBody(request))

      return successResponse(notification, "Notification archived.")
    }
  )
}
