import { ApiError, withApiRoute } from "@/lib/api"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AuthService } from "@/services/auth.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "rooms.transfer.removed",
    },
    async () => {
      const authService = new AuthService(await createSupabaseServerClient())

      await authService.requirePermission("rooms.manage")

      throw new ApiError(
        "ROOM_TRANSFER_REMOVED",
        "Room transfer has been permanently removed from this launch.",
        410
      )
    }
  )
}
