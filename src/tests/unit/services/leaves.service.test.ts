import { describe, expect, it, vi } from "vitest"

import { LeavesService } from "@/services/leaves.service"
import {
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  residentFixture,
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
    getCurrentContext: vi.fn().mockResolvedValue(adminAuthContext()),
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
    requireHostelAccess: vi.fn(),
  }
  const leavesRepository = {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  const residentsRepository = {
    getById: vi.fn(),
  }
  const organizationsRepository = {
    getOrganizationById: vi.fn(),
  }

  Object.assign(service, {
    authService,
    leavesRepository,
    residentsRepository,
    organizationsRepository,
  })

  return {
    service,
    authService,
    leavesRepository,
    residentsRepository,
    organizationsRepository,
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

  it("creates simplified resident leave requests with submitted contact metadata", async () => {
    const harness = createServiceHarness()
    const resident = residentFixture({
      date_of_birth: null,
      parent_phone: null,
      emergency_contact_phone: null,
      permanent_address: null,
    })
    const created = leaveRequestFixture({
      metadata: {
        workflow: "simplified_leave_request",
        submittedStudentName: "Resident User",
        submittedMobileNumber: "+919000000002",
        submittedWhatsappNumber: "+919000000003",
      },
    })

    harness.authService.getCurrentContext.mockResolvedValue(residentAuthContext())
    harness.residentsRepository.getById.mockResolvedValue(resident)
    harness.leavesRepository.create.mockResolvedValue(created)

    await expect(
      harness.service.createLeave({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        fullName: "Resident User",
        mobileNumber: "90000 00002",
        whatsappNumber: "90000 00003",
        fromDate: "2026-06-01",
        toDate: "2026-06-02",
        reason: "Family function",
        notes: "Need to leave today.",
      })
    ).resolves.toEqual(created)

    expect(harness.leavesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: "Need to leave today.",
        metadata: {
          workflow: "simplified_leave_request",
          submittedStudentName: "Resident User",
          submittedMobileNumber: "+919000000002",
          submittedWhatsappNumber: "+919000000003",
        },
      })
    )
  })

  it("loads leave settings from organization settings with operational support fallback", async () => {
    const harness = createServiceHarness()

    harness.organizationsRepository.getOrganizationById.mockResolvedValue({
      id: TEST_ORGANIZATION_ID,
      settings: {
        operationalControls: {
          support: {
            whatsapp: "90000 00009",
          },
        },
        leaveManagement: {
          reviewNotice: "Submit leave early for review.",
          urgentWhatsappEscalationEnabled: false,
        },
      },
    })

    await expect(
      harness.service.getLeaveSettings({
        organizationId: TEST_ORGANIZATION_ID,
      })
    ).resolves.toEqual({
      whatsappSupportNumber: "90000 00009",
      reviewNotice: "Submit leave early for review.",
      urgentWhatsappEscalationEnabled: false,
    })
  })
})
