import {
  createdResponse,
  getQueryParams,
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { StaffAccessService } from "@/services/staff-access.service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return withApiRoute(request, { route: "staff_access.users.list" }, async () => {
    const service = await StaffAccessService.create()
    const users = await service.listStaff(getQueryParams(request))

    return successResponse(users, "Staff access records loaded.")
  })
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "staff_access.users.create" }, async () => {
    const service = await StaffAccessService.create()
    const created = await service.createStaff(await parseJsonBody(request))

    return createdResponse(created, "Staff access created successfully.")
  })
}
