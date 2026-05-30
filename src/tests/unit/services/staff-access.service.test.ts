import { afterEach, describe, expect, it, vi } from "vitest"

import * as supabaseAdmin from "@/lib/supabase/admin"
import { AuthService } from "@/services/auth.service"
import { StaffAccessService } from "@/services/staff-access.service"
import { StaffAccessRepository } from "@/repositories/staff-access.repository"
import {
  ADMIN_USER_ID,
  TEST_ORGANIZATION_ID,
  userFixture,
  userRoleFixture,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

const TARGET_USER_ID = "00000000-0000-4000-8000-000000000044"
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000045"

function adminDbFixture() {
  return {
    channel: vi.fn(() => ({
      send: vi.fn().mockResolvedValue("ok"),
    })),
  }
}

describe("StaffAccessService RBAC synchronization", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("syncs users.default_role when a staff role assignment is changed", async () => {
    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(
      adminDbFixture() as never
    )
    vi.spyOn(AuthService.prototype, "requirePermission").mockResolvedValue(
      adminAuthContext({
        authUser: {
          ...adminAuthContext().authUser,
          id: ADMIN_USER_ID,
        },
        roles: ["owner"],
        primaryRole: "owner",
      })
    )
    vi.spyOn(StaffAccessRepository.prototype, "getPrimaryRoleAssignment").mockResolvedValue(
      userRoleFixture({
        user_id: TARGET_USER_ID,
        role: "admin",
      })
    )
    vi.spyOn(StaffAccessRepository.prototype, "updateRoleAssignment").mockResolvedValue(
      userRoleFixture({
        user_id: TARGET_USER_ID,
        role: "receptionist",
      })
    )
    vi.spyOn(StaffAccessRepository.prototype, "getUserById").mockResolvedValue(
      userFixture({
        id: TARGET_USER_ID,
        default_role: "admin",
      })
    )
    const updateUser = vi
      .spyOn(StaffAccessRepository.prototype, "updateUser")
      .mockResolvedValue(
        userFixture({
          id: TARGET_USER_ID,
          default_role: "receptionist",
        })
      )

    const service = new StaffAccessService({} as never, adminDbFixture() as never)

    await expect(
      service.updateStaff({
        organizationId: TEST_ORGANIZATION_ID,
        targetUserId: TARGET_USER_ID,
        role: "receptionist",
      })
    ).resolves.toMatchObject({
      role: "receptionist",
      user_id: TARGET_USER_ID,
    })

    expect(updateUser).toHaveBeenCalledWith(
      TARGET_USER_ID,
      expect.objectContaining({
        default_role: "receptionist",
        metadata: expect.objectContaining({
          staff_access_managed: true,
        }),
      })
    )
  })

  it("rejects role assignment updates that do not belong to the target user", async () => {
    vi.spyOn(supabaseAdmin, "createSupabaseAdminClient").mockReturnValue(
      adminDbFixture() as never
    )
    vi.spyOn(AuthService.prototype, "requirePermission").mockResolvedValue(
      adminAuthContext({
        roles: ["owner"],
        primaryRole: "owner",
      })
    )
    vi.spyOn(StaffAccessRepository.prototype, "getRoleAssignmentById").mockResolvedValue(
      userRoleFixture({
        id: "00000000-0000-4000-8000-000000000055",
        user_id: OTHER_USER_ID,
        role: "admin",
      })
    )
    const updateRoleAssignment = vi.spyOn(
      StaffAccessRepository.prototype,
      "updateRoleAssignment"
    )

    const service = new StaffAccessService({} as never, adminDbFixture() as never)

    await expect(
      service.updateStaff({
        organizationId: TEST_ORGANIZATION_ID,
        targetUserId: TARGET_USER_ID,
        roleAssignmentId: "00000000-0000-4000-8000-000000000055",
        role: "receptionist",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Role assignment does not belong to the target staff user.",
    })

    expect(updateRoleAssignment).not.toHaveBeenCalled()
  })
})
