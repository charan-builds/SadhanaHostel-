import { afterEach, describe, expect, it, vi } from "vitest"

import {
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { readApiResponse, routeContext } from "@/tests/helpers"
import type { LeadRow } from "@/types/admissions"

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
    is_active: false,
    deleted_at: "2026-06-04T09:00:00.000Z",
    deleted_by: null,
    metadata: {},
    created_at: "2026-06-03T00:00:00.000Z",
    updated_at: "2026-06-04T09:00:00.000Z",
    created_by: null,
    updated_by: null,
    ...overrides,
  }
}

describe("admission API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/admissions.service")
  })

  it("routes lead removal through AdmissionsService with tenant scope", async () => {
    const lead = leadFixture()
    const removeLead = vi.fn().mockResolvedValue(lead)

    vi.doMock("@/services/admissions.service", () => ({
      AdmissionsService: {
        create: vi.fn().mockResolvedValue({ removeLead }),
      },
    }))

    const { DELETE } = await import("@/app/api/admissions/leads/[id]/route")
    const response = await DELETE(
      new Request(
        `http://localhost/api/admissions/leads/${LEAD_ID}?organizationId=${TEST_ORGANIZATION_ID}`,
        { method: "DELETE" }
      ),
      routeContext({ id: LEAD_ID })
    )
    const body = await readApiResponse<typeof lead>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(removeLead).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      leadId: LEAD_ID,
    })
  })
})
