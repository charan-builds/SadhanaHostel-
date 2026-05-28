import type { User } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import { IdentityReconciliationService } from "@/services/operations"
import {
  RESIDENT_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  authUserFixture,
  userFixture,
  userRoleFixture,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"
import type { DemoDataResetReport } from "@/types/operations"

const GHOST_AUTH_USER_ID = "00000000-0000-4000-8000-000000000998"
const ADMIN_AUTH_USER_ID = "00000000-0000-4000-8000-000000000011"

function residentAuthUser(overrides: Partial<User> = {}): User {
  return {
    ...authUserFixture({
      id: GHOST_AUTH_USER_ID,
      email: "resident-00000000000040008000000000000998@auth.sadhanahostel.invalid",
      phone: "+919000000002",
    }),
    user_metadata: {
      organization_id: TEST_ORGANIZATION_ID,
      hostel_id: TEST_HOSTEL_ID,
      resident_id: "00000000-0000-4000-8000-000000009998",
      internal_auth_email: "resident-00000000000040008000000000000998@auth.sadhanahostel.invalid",
      activated_from_invite: true,
    },
    ...overrides,
  } as User
}

function createServiceHarness(input: {
  authUsers?: User[]
  residents?: Array<Record<string, unknown>>
  users?: Array<Record<string, unknown>>
  userRoles?: Array<Record<string, unknown>>
  roles?: Array<"owner" | "admin" | "super_admin">
} = {}) {
  const authUsers = input.authUsers ?? []
  const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
    residents: input.residents ?? [],
    users: input.users ?? [],
    user_roles: input.userRoles ?? [],
    audit_logs: [],
  }
  const db = {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: { users: authUsers },
          error: null,
        }),
        getUserById: vi.fn().mockImplementation(async (userId: string) => ({
          data: {
            user: authUsers.find((user) => user.id === userId) ?? null,
          },
          error: authUsers.some((user) => user.id === userId)
            ? null
            : { message: "User not found" },
        })),
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
    from: vi.fn((table: string) => createQuery(rowsByTable[table] ?? [])),
  }
  const authService = {
    requireRole: vi.fn().mockResolvedValue(
      adminAuthContext({
        roles: input.roles ?? ["owner"],
        primaryRole: (input.roles ?? ["owner"])[0],
      })
    ),
    requireHostelAccess: vi.fn(),
  }
  const service = new IdentityReconciliationService(authService as never, db as never)

  return {
    service,
    db,
  }
}

describe("IdentityReconciliationService", () => {
  it("detects and dry-runs cleanup for orphan resident auth identities", async () => {
    const ghost = residentAuthUser()
    const harness = createServiceHarness({
      authUsers: [ghost],
    })

    const report = await harness.service.scan({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "auth_without_resident",
          authUserId: ghost.id,
          safeAutoRepair: true,
          recommendedRepairAction: "delete_orphan_auth",
        }),
      ])
    )

    const result = await harness.service.repair({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      dryRun: true,
      action: "repair_safe",
    })

    expect(result.deletedAuthUsers).toBe(1)
    expect(harness.db.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("deletes only safe orphan resident auth users during identity repair execution", async () => {
    const ghost = residentAuthUser()
    const harness = createServiceHarness({
      authUsers: [ghost],
    })

    const result = await harness.service.repair({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      dryRun: false,
      action: "repair_safe",
    })

    expect(result.deletedAuthUsers).toBe(1)
    expect(harness.db.auth.admin.deleteUser).toHaveBeenCalledWith(ghost.id)
  })

  it("blocks destructive auth cleanup for non-owner admins", async () => {
    const ghost = residentAuthUser()
    const harness = createServiceHarness({
      authUsers: [ghost],
      roles: ["admin"],
    })

    await expect(
      harness.service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: false,
        action: "repair_safe",
      })
    ).rejects.toThrow("Only owners can delete orphan resident auth identities.")

    expect(harness.db.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it("detects resident auth ghosts when only the public resident profile remains", async () => {
    const residentAuth = {
      ...authUserFixture({
        id: RESIDENT_USER_ID,
        email: "resident.test@sadhanahostel.example",
        phone: "+919000000002",
      }),
      user_metadata: {
        organization_id: TEST_ORGANIZATION_ID,
      },
    } as User
    const harness = createServiceHarness({
      authUsers: [residentAuth],
      users: [
        userFixture({
          id: residentAuth.id,
          default_role: "resident",
          email: residentAuth.email,
          phone: residentAuth.phone,
        }),
      ],
      userRoles: [
        userRoleFixture({
          user_id: residentAuth.id,
          role: "resident",
        }),
      ],
    })

    const report = await harness.service.scan({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "auth_without_resident",
          authUserId: residentAuth.id,
          safeAutoRepair: true,
          recommendedRepairAction: "delete_orphan_auth",
        }),
      ])
    )
  })

  it("never plans admin auth identities for demo reset cleanup", async () => {
    const ghost = residentAuthUser()
    const adminAuth = {
      ...authUserFixture({
        id: ADMIN_AUTH_USER_ID,
        email: "admin.test@sadhanahostel.example",
        phone: "+919000000001",
      }),
      user_metadata: {
        organization_id: TEST_ORGANIZATION_ID,
      },
    } as User
    const harness = createServiceHarness({
      authUsers: [ghost, adminAuth],
      users: [
        userFixture({
          id: ADMIN_AUTH_USER_ID,
          default_role: "admin",
        }),
      ],
      userRoles: [
        userRoleFixture({
          user_id: ADMIN_AUTH_USER_ID,
          role: "admin",
        }),
      ],
    })

    const plan = await harness.service.prepareAuthCleanupForReset(
      resetReport({
        authUsers: [
          { id: ghost.id, email: ghost.email, phone: ghost.phone, reason: "test resident" },
          { id: adminAuth.id, email: adminAuth.email, phone: adminAuth.phone, reason: "bad report" },
        ],
      })
    )

    expect(plan.authUsers.map((user) => user.id)).toEqual([ghost.id])
    expect(plan.warnings.join("\n")).toContain("public user role is admin")
  })

  it("reports duplicate normalized resident phones as identity drift", async () => {
    const harness = createServiceHarness({
      residents: [
        residentRow({ id: "resident-1", phone: "+91 90000 00002" }),
        residentRow({ id: "resident-2", phone: "9000000002" }),
      ],
    })

    const report = await harness.service.scan({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "duplicate_phone",
          recommendedRepairAction: "dedupe_identity",
          safeAutoRepair: false,
        }),
      ])
    )
  })

  it("reports duplicate normalized auth phones as identity drift", async () => {
    const first = residentAuthUser({
      id: "00000000-0000-4000-8000-000000000901",
      email: "resident-00000000000040008000000000000901@auth.sadhanahostel.invalid",
      phone: "+91 90000 00002",
      user_metadata: {
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: "00000000-0000-4000-8000-000000000901",
        internal_auth_email: "resident-00000000000040008000000000000901@auth.sadhanahostel.invalid",
      },
    })
    const second = residentAuthUser({
      id: "00000000-0000-4000-8000-000000000902",
      email: "resident-00000000000040008000000000000902@auth.sadhanahostel.invalid",
      phone: "9000000002",
      user_metadata: {
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: "00000000-0000-4000-8000-000000000902",
        internal_auth_email: "resident-00000000000040008000000000000902@auth.sadhanahostel.invalid",
      },
    })
    const harness = createServiceHarness({
      authUsers: [first, second],
    })

    const report = await harness.service.scan({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "duplicate_phone",
          authUserId: first.id,
          recommendedRepairAction: "review_manually",
          safeAutoRepair: false,
        }),
      ])
    )
  })

  it("reports orphan resident public profiles left without auth or resident linkage", async () => {
    const harness = createServiceHarness({
      users: [
        userFixture({
          id: RESIDENT_USER_ID,
          default_role: "resident",
          email: "resident.test@sadhanahostel.example",
          phone: "+919000000002",
        }),
      ],
      userRoles: [
        userRoleFixture({
          user_id: RESIDENT_USER_ID,
          role: "resident",
        }),
      ],
    })

    const report = await harness.service.scan({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `orphan-public-user:${RESIDENT_USER_ID}`,
          category: "invalid_linkage",
          recommendedRepairAction: "review_manually",
          safeAutoRepair: false,
        }),
      ])
    )
  })
})

function createQuery(rows: Array<Record<string, unknown>>) {
  const filters: Array<{ column: string; value: unknown }> = []
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value })
      return query
    }),
    maybeSingle: vi.fn(async () => ({
      data: filterRows(rows, filters)[0] ?? null,
      error: null,
    })),
    insert: vi.fn(async () => ({ error: null })),
    then: (
      resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: filterRows(rows, filters), error: null }).then(resolve, reject),
  }

  return query
}

function filterRows(
  rows: Array<Record<string, unknown>>,
  filters: Array<{ column: string; value: unknown }>
) {
  return rows.filter((row) => {
    return filters.every((filter) => row[filter.column] === filter.value)
  })
}

function residentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "resident-1",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    user_id: null,
    full_name: "Resident User",
    email: null,
    phone: "+919000000002",
    status: "draft",
    onboarding_status: "invited",
    is_active: true,
    deleted_at: null,
    ...overrides,
  }
}

function resetReport(overrides: Partial<DemoDataResetReport> = {}): DemoDataResetReport {
  return {
    dryRun: true,
    organizationId: TEST_ORGANIZATION_ID,
    hostelId: TEST_HOSTEL_ID,
    rows: {},
    deletedRows: {},
    authUsers: [],
    storageObjects: [],
    preserved: [],
    warnings: [],
    confirmationRequired: "RESET DEMO DATA",
    sequencesReset: [],
    ...overrides,
  }
}
