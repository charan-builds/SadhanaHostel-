import { parseJsonBody, successResponse, withApiRoute } from "@/lib/api"
import { PushSubscriptionsService } from "@/services/pwa/push-subscriptions.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "notifications.push_subscriptions.revoke",
    },
    async () => {
      const service = await PushSubscriptionsService.create()
      const result = await service.revoke(await parseJsonBody(request))

      return successResponse(result, "Push subscription revoked.")
    }
  )
}
