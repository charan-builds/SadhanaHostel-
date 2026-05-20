import type { AuthContext } from "@/services/auth.service"

import {
  ADMIN_USER_ID,
  authUserFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  userFixture,
  userRoleFixture,
} from "@/tests/fixtures"

export function adminAuthContext(
  overrides: Partial<AuthContext> = {}
): AuthContext {
  const profile = userFixture()
  const roleAssignments = [userRoleFixture()]

  return {
    authUser: authUserFixture({ id: ADMIN_USER_ID }),
    profile,
    roleAssignments,
    roles: ["admin"],
    primaryRole: "admin",
    organizationId: TEST_ORGANIZATION_ID,
    hostelIds: [TEST_HOSTEL_ID],
    ...overrides,
  }
}

export function residentAuthContext(
  overrides: Partial<AuthContext> = {}
): AuthContext {
  const profile = userFixture({
    id: "00000000-0000-4000-8000-000000000012",
    full_name: "Resident User",
    email: "resident.test@sadhanahostel.example",
    default_role: "resident",
  })
  const roleAssignments = [
    userRoleFixture({
      id: "00000000-0000-4000-8000-000000000022",
      user_id: profile.id,
      role: "resident",
    }),
  ]

  return {
    authUser: authUserFixture({
      id: profile.id,
      email: profile.email ?? undefined,
      phone: profile.phone ?? undefined,
    }),
    profile,
    roleAssignments,
    roles: ["resident"],
    primaryRole: "resident",
    organizationId: TEST_ORGANIZATION_ID,
    hostelIds: [TEST_HOSTEL_ID],
    ...overrides,
  }
}
