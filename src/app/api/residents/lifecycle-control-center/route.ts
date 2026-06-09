import {
  getQueryParams,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { LifecycleControlCenterService } from "@/services/resident-lifecycle"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(
    request,
    {
      route: "residents.lifecycle_control_center",
    },
    async () => {
      const service = await LifecycleControlCenterService.create()
      const center = await service.getControlCenter(getQueryParams(request))

      return successResponse(center, "Resident lifecycle control center loaded.")
    }
  )
}
