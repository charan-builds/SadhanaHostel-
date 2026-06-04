import { describe, expect, it, vi } from "vitest"

import { AdmissionsService } from "@/services/admissions.service"
import type { LeadRow } from "@/types/admissions"
import {
  ADMIN_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

const LEAD_ID = "00000000-0000-4000-8000-000000000061"

function leadFixture(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: LEAD_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    full_name: "Lead User",
    phone: "+91 90000 00009",
    whatsapp_number: "+91 90000 00009",
    email: "lead.test@sadhanahostel.example",
    resident_type: "student",
    desired_joining_date: null,
    expected_stay_duration: null,
    parent_name: null,
    parent_phone: null,
    notes: null,
    source: "website",
    status: "called",
    assigned_to: null,
    last_contacted_at: "2026-06-04T08:00:00.000Z",
    next_follow_up_at: null,
    cancelled_reason: null,
    joined_resident_id: null,
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    metadata: {},
    created_at: "2026-06-03T00:00:00.000Z",
    updated_at: "2026-06-04T08:00:00.000Z",
    created_by: ADMIN_USER_ID,
    updated_by: ADMIN_USER_ID,
    ...overrides,
  }
}

function createServiceHarness() {
  const service = new AdmissionsService({} as never)
  const authContext = adminAuthContext()
  const authService = {
    requirePermission: vi.fn().mockResolvedValue(authContext),
    requireHostelAccess: vi.fn(),
  }
  const admissionsRepository = {
    getLeadById: vi.fn(),
    removeLead: vi.fn(),
  }
  const eventPublisher = {
    publish: vi.fn().mockResolvedValue(null),
  }

  Object.assign(service, {
    authService,
    admissionsRepository,
    eventPublisher,
  })

  return {
    service,
    authService,
    admissionsRepository,
    eventPublisher,
  }
}

describe("AdmissionsService", () => {
  it("soft-removes a contacted lead from the active workspace", async () => {
    const harness = createServiceHarness()
    const lead = leadFixture()
    const removedLead = leadFixture({
      is_active: false,
      deleted_at: "2026-06-04T09:00:00.000Z",
      deleted_by: ADMIN_USER_ID,
    })

    harness.admissionsRepository.getLeadById.mockResolvedValue(lead)
    harness.admissionsRepository.removeLead.mockResolvedValue(removedLead)

    await expect(
      harness.service.removeLead({
        organizationId: TEST_ORGANIZATION_ID,
        leadId: LEAD_ID,
      })
    ).resolves.toEqual(removedLead)

    expect(harness.authService.requirePermission).toHaveBeenCalledWith("admissions.manage")
    expect(harness.authService.requireHostelAccess).toHaveBeenCalledWith(
      adminAuthContext(),
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
    expect(harness.admissionsRepository.removeLead).toHaveBeenCalledWith(
      LEAD_ID,
      TEST_ORGANIZATION_ID,
      ADMIN_USER_ID
    )
    expect(harness.eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "lead.removed",
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        actorUserId: ADMIN_USER_ID,
        payload: { leadId: LEAD_ID },
      })
    )
  })
})
