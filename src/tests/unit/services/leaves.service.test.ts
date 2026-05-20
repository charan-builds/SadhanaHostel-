import { describe, expect, it, vi } from "vitest"

import { LeavesService } from "@/services/leaves.service"
import {
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"
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
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
  }
  const leavesRepository = {
    getById: vi.fn(),
    update: vi.fn(),
  }
  const residentsRepository = {}

  Object.assign(service, {
    authService,
    leavesRepository,
    residentsRepository,
  })

  return {
    service,
    leavesRepository,
  }
}

describe("LeavesService", () => {
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
