import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ConsistencyService,
  scanConsistency,
} from "@/services/operations/consistency.service"
import {
  RESIDENT_ID,
  ROOM_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createRepository(overrides: Partial<{
  count: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  repairOccupancyConsistency: ReturnType<typeof vi.fn>
  repairTenantLinkageConsistency: ReturnType<typeof vi.fn>
  repairOnboardingAccessConsistency: ReturnType<typeof vi.fn>
  listResidentTenantIdentityAnomalies: ReturnType<typeof vi.fn>
  reconcileInvalidDues: ReturnType<typeof vi.fn>
  repairAnalyticsConsistency: ReturnType<typeof vi.fn>
  recordConsistencyReport: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    count: vi.fn().mockResolvedValue(0),
    list: vi.fn().mockResolvedValue([]),
    repairOccupancyConsistency: vi.fn().mockResolvedValue({
      invalidAllocationsRepaired: 0,
      duplicateAllocationsRepaired: 0,
      hostelsRecalculated: 1,
    }),
    repairTenantLinkageConsistency: vi.fn().mockResolvedValue({
      roomAllocationsRepaired: 0,
      monthlyFeeRecordsRepaired: 0,
      invoicesRepaired: 0,
      paymentsRepaired: 0,
      residentInvitesRepaired: 0,
      reservationsRepaired: 0,
      reservationPaymentsRepaired: 0,
      documentsRepaired: 0,
      hostelsRecalculated: 1,
    }),
    repairOnboardingAccessConsistency: vi.fn().mockResolvedValue({
      expiredCount: 0,
      activatedInvitesRevokedCount: 0,
      duplicateInvitesRevokedCount: 0,
      authProfilesSyncedCount: 0,
      deadlockResidentsAdvancedCount: 0,
    }),
    listResidentTenantIdentityAnomalies: vi.fn().mockResolvedValue([]),
    reconcileInvalidDues: vi.fn().mockResolvedValue({
      feeRecordsCancelled: 0,
      invoicesCancelled: 0,
    }),
    repairAnalyticsConsistency: vi.fn().mockResolvedValue({
      hostelsRecalculated: 1,
    }),
    recordConsistencyReport: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

describe("operational consistency scanning", () => {
  it("reports active allocations linked to inactive residents with an occupancy repair action", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string; equals?: Record<string, unknown> }) => {
        if (table === "room_allocations" && input.equals?.status === "active") {
          return Promise.resolve([
            {
              id: "allocation-1",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              room_id: ROOM_ID,
              resident_id: RESIDENT_ID,
              status: "active",
            },
          ])
        }

        if (table === "rooms") {
          return Promise.resolve([{ id: ROOM_ID, capacity: 4 }])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "allocations.without_active_resident",
          severity: "critical",
          repairAction: "release_stale_allocations",
          count: 1,
        }),
      ])
    )
  })

  it("does not flag duplicate draft admission phones as production resident duplicates", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("phone,email")) {
          return Promise.resolve([
            {
              id: "draft-1",
              phone: "+91 90000 00001",
              email: null,
              full_name: "Draft One",
              aadhaar_last4: null,
              status: "draft",
              is_active: true,
              user_id: null,
            },
            {
              id: "draft-2",
              phone: "+91 90000 00001",
              email: null,
              full_name: "Draft Two",
              aadhaar_last4: null,
              status: "draft",
              is_active: true,
              user_id: null,
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings.some((finding) => finding.id === "residents.duplicates")).toBe(false)
  })

  it("reports tenant linkage anomalies with affected table details and safe repair action", async () => {
    const otherHostelId = "00000000-0000-4000-8000-000000000099"
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("deleted_at")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              status: "active",
              is_active: true,
              deleted_at: null,
            },
          ])
        }

        if (table === "payments") {
          return Promise.resolve([
            {
              id: "payment-1",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: otherHostelId,
              resident_id: RESIDENT_ID,
              monthly_fee_record_id: null,
              invoice_id: null,
              status: "pending",
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "security.business_tenant_scope",
          repairAction: "repair_tenant_linkage",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "payments",
              recordId: "payment-1",
              expectedHostelId: TEST_HOSTEL_ID,
              actualHostelId: otherHostelId,
            }),
          ]),
        }),
      ])
    )
  })

  it("does not flag finance records linked to archived residents in the same tenant", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("user_id")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              user_id: null,
              status: "archived",
              is_active: false,
              deleted_at: "2026-05-24T00:00:00.000Z",
            },
          ])
        }

        if (table === "payments") {
          return Promise.resolve([
            {
              id: "payment-archived",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              resident_id: RESIDENT_ID,
              monthly_fee_record_id: null,
              invoice_id: null,
              status: "verified",
            },
          ])
        }

        if (table === "invoices") {
          return Promise.resolve([
            {
              id: "invoice-archived",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              resident_id: RESIDENT_ID,
              monthly_fee_record_id: null,
              pdf_document_id: null,
              status: "paid",
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings.some((finding) => finding.id === "security.business_tenant_scope")).toBe(false)
  })

  it("reports resident onboarding auth ownership tenant mismatches", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("user_id")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              user_id: "missing-user",
              status: "active",
              is_active: true,
              deleted_at: null,
            },
          ])
        }

        if (table === "users") {
          return Promise.resolve([])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "security.business_tenant_scope",
          repairAction: "review_manually",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "residents",
              recordId: RESIDENT_ID,
              anomalyType: "resident_user_tenant_mismatch_orphan_auth_user_profile",
            }),
          ]),
        }),
      ])
    )
  })

  it("does not report matching organization resident auth profiles as hostel mismatches", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("user_id")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              user_id: "user-1",
              status: "active",
              is_active: true,
              deleted_at: null,
            },
          ])
        }

        if (table === "users") {
          return Promise.resolve([
            {
              id: "user-1",
              organization_id: TEST_ORGANIZATION_ID,
              is_active: true,
              deleted_at: null,
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings.some((finding) => finding.id === "security.business_tenant_scope")).toBe(false)
  })

  it("does not report archived residents with historical auth links", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("user_id")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              user_id: "missing-user",
              status: "archived",
              is_active: false,
              deleted_at: "2026-06-01T10:37:42.950842+00:00",
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings.some((finding) => finding.id === "security.business_tenant_scope")).toBe(false)
  })

  it("reports tenantless resident identity anomalies as manual repair findings", async () => {
    const repository = createRepository({
      listResidentTenantIdentityAnomalies: vi.fn().mockResolvedValue([
        {
          table_name: "residents",
          record_id: RESIDENT_ID,
          resident_id: RESIDENT_ID,
          organization_id: null,
          hostel_id: null,
          user_id: null,
          expected_organization_id: null,
          expected_hostel_id: null,
          anomaly_type: "resident_missing_organization_id",
          expected_state: "resident has a valid organization_id before normalization",
          actual_state: "resident.organization_id is null",
          recommended_repair_action: "review_manually",
          recommendation: "Review source records before relinking or archiving this resident.",
        },
      ]),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(repository.listResidentTenantIdentityAnomalies).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      limit: 100,
    })
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "security.resident_tenant_identity",
          severity: "critical",
          repairAction: "review_manually",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "residents",
              recordId: RESIDENT_ID,
              anomalyType: "resident_missing_organization_id",
              actualOrganizationId: null,
            }),
          ]),
        }),
      ])
    )
  })

  it("reports duplicate active invites with record-level repair guidance", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string; equals?: Record<string, unknown> }) => {
        if (table === "resident_invites" && input.equals?.status === "pending") {
          return Promise.resolve([
            {
              id: "invite-1",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              resident_id: RESIDENT_ID,
              status: "pending",
              expires_at: "2999-01-01T00:00:00.000Z",
            },
            {
              id: "invite-2",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              resident_id: RESIDENT_ID,
              status: "pending",
              expires_at: "2999-01-01T00:00:00.000Z",
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "invites.duplicate_active",
          repairAction: "dedupe_invites",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "resident_invites",
              residentId: RESIDENT_ID,
              expectedState: expect.stringContaining("one pending active invite"),
              recommendedRepairAction: "dedupe_invites",
            }),
          ]),
        }),
      ])
    )
  })

  it("reports pending invite identity mode mismatches before residents activate", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("user_id")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              user_id: null,
              status: "draft",
              onboarding_status: "invited",
              full_name: "Charan",
              phone: "9000000002",
              email: null,
              deleted_at: null,
            },
          ])
        }

        if (table === "resident_invites" && input.select?.includes("email,phone")) {
          return Promise.resolve([
            {
              id: "invite-email-only",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              resident_id: RESIDENT_ID,
              status: "pending",
              email: "resident@sadhanahostel.example",
              phone: null,
              used_at: null,
              revoked_at: null,
              expires_at: "2999-01-01T00:00:00.000Z",
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "onboarding.invite_identity_mode_mismatch",
          repairAction: "dedupe_invites",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "resident_invites",
              recordId: "invite-email-only",
              anomalyType: "invite_identity_mode_mismatch",
              expectedState: expect.stringContaining("Phone Only"),
              actualState: expect.stringContaining("Email Only"),
            }),
          ]),
        }),
      ])
    )
  })

  it("reports stale auth identity mode metadata after resident contact changes", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("user_id")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              user_id: "user-1",
              status: "draft",
              onboarding_status: "activated",
              full_name: "Charan",
              phone: "9000000002",
              email: null,
              deleted_at: null,
            },
          ])
        }

        if (table === "users") {
          return Promise.resolve([
            {
              id: "user-1",
              organization_id: TEST_ORGANIZATION_ID,
              is_active: true,
              default_role: "resident",
              metadata: {
                resident_identity_mode: "email",
              },
              deleted_at: null,
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "onboarding.auth_identity_mode_mismatch",
          repairAction: "resync_auth_linkage",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "residents",
              recordId: RESIDENT_ID,
              anomalyType: "auth_identity_mode_mismatch",
              expectedState: expect.stringContaining("Phone Only"),
              actualState: expect.stringContaining("Email Only"),
            }),
          ]),
        }),
      ])
    )
  })

  it("reports mixed-format phone identities that can break auth matching", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select === "id,organization_id,hostel_id,phone,user_id,deleted_at") {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              phone: "90000 00002",
              user_id: null,
              deleted_at: null,
            },
          ])
        }

        if (table === "resident_invites" && input.select === "id,organization_id,hostel_id,resident_id,phone,status,used_at,revoked_at") {
          return Promise.resolve([
            {
              id: "invite-1",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              resident_id: RESIDENT_ID,
              phone: "9000000002",
              status: "pending",
              used_at: null,
              revoked_at: null,
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "identity.phone_normalization_mismatch",
          severity: "high",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "residents",
              anomalyType: "phone_not_e164",
              expectedState: "+919000000002",
            }),
          ]),
        }),
      ])
    )
  })

  it("reports inactive resident dues and recommends ledger reconciliation", async () => {
    const repository = createRepository({
      list: vi.fn().mockImplementation((table: string, input: { select?: string }) => {
        if (table === "residents" && input.select?.includes("checkout_on")) {
          return Promise.resolve([
            {
              id: RESIDENT_ID,
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              user_id: null,
              status: "draft",
              is_active: true,
              checkout_on: null,
              onboarding_status: "invited",
              deleted_at: null,
            },
          ])
        }

        if (table === "monthly_fee_records") {
          return Promise.resolve([
            {
              id: "fee-1",
              organization_id: TEST_ORGANIZATION_ID,
              hostel_id: TEST_HOSTEL_ID,
              resident_id: RESIDENT_ID,
              status: "pending",
              paid_amount: 0,
              balance_amount: 3500,
              period_month: "2026-05-01",
            },
          ])
        }

        return Promise.resolve([])
      }),
    })

    const report = await scanConsistency(repository as never, {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dues.inactive_resident_open_balances",
          repairAction: "reconcile_dues",
          details: expect.arrayContaining([
            expect.objectContaining({
              tableName: "monthly_fee_records",
              residentId: RESIDENT_ID,
              expectedState: expect.stringContaining("operational verified residents"),
            }),
          ]),
        }),
      ])
    )
  })
})

describe("ConsistencyService repair", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("repairs occupancy through the atomic repository function and records a follow-up scan", async () => {
    const service = new ConsistencyService({} as never)
    const repository = createRepository({
      repairOccupancyConsistency: vi.fn().mockResolvedValue({
        invalidAllocationsRepaired: 2,
        duplicateAllocationsRepaired: 1,
        hostelsRecalculated: 1,
      }),
    })

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "recalculate_occupancy",
        dryRun: false,
      })
    ).resolves.toMatchObject({
      repaired: 4,
      dryRun: false,
      message: expect.stringContaining("2 invalid allocation"),
    })

    expect(repository.repairOccupancyConsistency).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      actorUserId: adminAuthContext().authUser.id,
    })
    expect(repository.recordConsistencyReport).toHaveBeenCalled()
  })

  it("repairs same-organization tenant linkage through the atomic repository function", async () => {
    const service = new ConsistencyService({} as never)
    const repository = createRepository({
      repairTenantLinkageConsistency: vi.fn().mockResolvedValue({
        roomAllocationsRepaired: 1,
        monthlyFeeRecordsRepaired: 1,
        invoicesRepaired: 1,
        paymentsRepaired: 1,
        residentInvitesRepaired: 1,
        reservationsRepaired: 1,
        reservationPaymentsRepaired: 1,
        documentsRepaired: 1,
        hostelsRecalculated: 1,
      }),
    })

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "repair_tenant_linkage",
        dryRun: false,
      })
    ).resolves.toMatchObject({
      repaired: 9,
      dryRun: false,
      message: expect.stringContaining("Tenant linkage repaired"),
    })

    expect(repository.repairTenantLinkageConsistency).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      actorUserId: adminAuthContext().authUser.id,
    })
    expect(repository.recordConsistencyReport).toHaveBeenCalled()
  })

  it("supports dry-run repair without mutating records", async () => {
    const service = new ConsistencyService({} as never)
    const repository = createRepository({
      repairOccupancyConsistency: vi.fn(),
    })

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "release_stale_allocations",
        dryRun: true,
      })
    ).resolves.toMatchObject({
      repaired: 0,
      dryRun: true,
      report: expect.any(Object),
    })

    expect(repository.repairOccupancyConsistency).not.toHaveBeenCalled()
  })

  it("blocks mutating repairs when the emergency repair kill switch is disabled", async () => {
    vi.stubEnv("OPERATIONAL_REPAIRS_ENABLED", "false")

    const service = new ConsistencyService({} as never)
    const repository = createRepository({
      repairOccupancyConsistency: vi.fn(),
    })

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "recalculate_occupancy",
        dryRun: false,
      })
    ).resolves.toMatchObject({
      repaired: 0,
      dryRun: true,
      message: expect.stringContaining("OPERATIONAL_REPAIRS_ENABLED=false"),
    })

    expect(repository.repairOccupancyConsistency).not.toHaveBeenCalled()
    expect(repository.recordConsistencyReport).not.toHaveBeenCalled()
  })

  it("dedupes invites and resyncs auth linkage through onboarding access repair", async () => {
    const service = new ConsistencyService({} as never)
    const repository = createRepository({
      repairOnboardingAccessConsistency: vi.fn().mockResolvedValue({
        expiredCount: 1,
        activatedInvitesRevokedCount: 1,
        duplicateInvitesRevokedCount: 2,
        authProfilesSyncedCount: 1,
        deadlockResidentsAdvancedCount: 1,
      }),
    })

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "dedupe_invites",
        dryRun: false,
      })
    ).resolves.toMatchObject({
      repaired: 6,
      dryRun: false,
      message: expect.stringContaining("duplicate invite"),
    })

    expect(repository.repairOnboardingAccessConsistency).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      actorUserId: adminAuthContext().authUser.id,
    })
  })

  it("reconciles invalid dues through the atomic finance repair", async () => {
    const service = new ConsistencyService({} as never)
    const repository = createRepository({
      reconcileInvalidDues: vi.fn().mockResolvedValue({
        feeRecordsCancelled: 2,
        invoicesCancelled: 1,
      }),
    })

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "reconcile_dues",
        dryRun: false,
      })
    ).resolves.toMatchObject({
      repaired: 3,
      dryRun: false,
      message: expect.stringContaining("Dues reconciled"),
    })

    expect(repository.reconcileInvalidDues).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      actorUserId: adminAuthContext().authUser.id,
    })
  })
})
