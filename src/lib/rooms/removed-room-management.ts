import "server-only"

import { withApiRoute } from "@/lib/api"
import { AuthService } from "@/services/auth.service"

type RemovedRoomFeature = "management" | "allocation" | "transfer"

const removedRoomFeatureCopy: Record<
  RemovedRoomFeature,
  { code: string; message: string }
> = {
  management: {
    code: "ROOM_MANAGEMENT_REMOVED",
    message: "Room management has been permanently removed from this launch.",
  },
  allocation: {
    code: "ROOM_ALLOCATION_REMOVED",
    message: "Room allocation has been permanently removed from this launch.",
  },
  transfer: {
    code: "ROOM_TRANSFER_REMOVED",
    message: "Room transfer has been permanently removed from this launch.",
  },
}

export function removedRoomManagementRoute(
  request: Request,
  route: string,
  feature: RemovedRoomFeature = "management"
) {
  return withApiRoute(
    request,
    {
      route,
    },
    async () => {
      const authService = await AuthService.create()

      await authService.requirePermission("rooms.manage")

      const removedFeature = removedRoomFeatureCopy[feature]

      return Response.json(
        {
          success: false,
          error: removedFeature,
        },
        { status: 410 }
      )
    }
  )
}
