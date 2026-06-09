import { describe, expect, it, vi } from "vitest"

import { LeavesService } from "@/services/leaves.service"
import {
  RESIDENT_ID,
  residentFixture,
  RESIDENT_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext, residentAuthContext } from "@/tests/helpers"
import type { Tables } from "@/types/database"

const LEAVE_REQUEST_ID = "00000000-0000-4000-8000-000000000061"

function leaveRequestFixture(
  overrides: Partial<Tables<"leave_requests">> = {}
): Tables<"leave_requests"> {
  return {
    id: LEAVE_REQUEST_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: RESIDENT_ID,
    from_date: "2026-06-01",
    to_date: "2026-06-02",
    reason: "Family function",
    destination: null,
    travel_mode: null,
    status: "pending",
    rejection_reason: null,
    reviewed_at: null,
    reviewed_by: null,
    departed_at: null,
    returned_at: null,
    parent_notified_at: null,
    notes: null,
    metadata: {},
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

function createServiceHarness() {
  const service = new LeavesService({} as never)
  const authService = {
    getCurrentContext: vi.fn().mockResolvedValue(
      residentAuthContext({
        authUser: {
          ...residentAuthContext().authUser,
          id: RESIDENT_USER_ID,
        },
      })
    ),
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
    requireHostelAccess: vi.fn(),
  }
  const leavesRepository = {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  }
  const residentsRepository = {
    getById: vi.fn(),
  }

  Object.assign(service, {
    authService,
    leavesRepository,
    residentsRepository,
  })

  return {
    service,
    leavesRepository,
    residentsRepository,
  }
}

function leaveInput() {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    hostelId: TEST_HOSTEL_ID,
    residentId: RESIDENT_ID,
    fromDate: "2026-06-20",
    toDate: "2026-06-21",
    reason: "Family function",
  }
}

describe("LeavesService", () => {
  it("blocks a new draft resident from leave access", async () => {
    const harness = createServiceHarness()

    harness.residentsRepository.getById.mockResolvedValue({
      ...residentFixture({
        status: "draft",
        user_id: RESIDENT_USER_ID,
        date_of_birth: null,
        permanent_address: null,
      }),
      onboarding_status: "profile_incomplete",
    })

    await expect(harness.service.createLeave(leaveInput())).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Complete all required resident profile details before applying leave.",
    })
    expect(harness.leavesRepository.create).not.toHaveBeenCalled()
  })

  it("blocks a completed profile until the activation transition is committed", async () => {
    const harness = createServiceHarness()

    harness.residentsRepository.getById.mockResolvedValue({
      ...residentFixture({
        status: "active",
        user_id: RESIDENT_USER_ID,
        date_of_birth: "2000-01-01",
        permanent_address: "Sadhana Boys Hostel, Pulivendula, Andhra Pradesh",
        metadata: {
          onboarding: {
            hostelRulesAcceptance: {
              accepted: true,
              version: "2026-06-02",
              acceptedAt: "2026-06-09T00:00:00.000Z",
            },
          },
        },
      }),
      onboarding_status: "profile_incomplete",
    })

    await expect(harness.service.createLeave(leaveInput())).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Complete resident profile activation before applying leave.",
    })
    expect(harness.leavesRepository.create).not.toHaveBeenCalled()
  })

  it("allows an active, verified resident to create their own leave request", async () => {
    const harness = createServiceHarness()
    const activeResident = {
      ...residentFixture({
        status: "active",
        user_id: RESIDENT_USER_ID,
        date_of_birth: "2000-01-01",
        permanent_address: "Sadhana Boys Hostel, Pulivendula, Andhra Pradesh",
      }),
      onboarding_status: "verified",
    }
    const created = leaveRequestFixture()

    harness.residentsRepository.getById.mockResolvedValue(activeResident)
    harness.leavesRepository.create.mockResolvedValue(created)

    await expect(harness.service.createLeave(leaveInput())).resolves.toEqual(created)
    expect(harness.leavesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: RESIDENT_ID,
        created_by: RESIDENT_USER_ID,
      })
    )
  })

  it("requires rejection reason when rejecting leave", async () => {
    const harness = createServiceHarness()

    harness.leavesRepository.getById.mockResolvedValue(leaveRequestFixture())

    await expect(
      harness.service.reviewLeave({
        organizationId: TEST_ORGANIZATION_ID,
        leaveRequestId: LEAVE_REQUEST_ID,
        status: "rejected",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Rejection reason is required when rejecting leave.",
    })

    expect(harness.leavesRepository.update).not.toHaveBeenCalled()
  })

  it("approves a pending leave request", async () => {
    const harness = createServiceHarness()
    const approved = leaveRequestFixture({ status: "approved" })

    harness.leavesRepository.getById.mockResolvedValue(leaveRequestFixture())
    harness.leavesRepository.update.mockResolvedValue(approved)

    await expect(
      harness.service.reviewLeave({
        organizationId: TEST_ORGANIZATION_ID,
        leaveRequestId: LEAVE_REQUEST_ID,
        status: "approved",
      })
    ).resolves.toEqual(approved)
  })
})
