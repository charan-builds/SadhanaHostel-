import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { NotificationService } from "@/services/notifications"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "notifications.mark_all_read",
    },
    async () => {
      const service = await NotificationService.create()
      const result = await service.markAllRead(await parseJsonBody(request))

      return successResponse(result, "Notifications marked read.")
    }
  )
}
