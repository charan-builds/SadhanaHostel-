import { describe, expect, it, vi } from "vitest"

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
          repairAction: "recalculate_occupancy",
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
})

describe("ConsistencyService repair", () => {
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
        requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
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
        requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
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
})
