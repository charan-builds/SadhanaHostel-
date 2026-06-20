import { afterEach, describe, expect, it, vi } from "vitest"

import {
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { createJsonRequest, readApiResponse } from "@/tests/helpers"

describe("financial corrections API route", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/financial-corrections.service")
  })

  it("routes an audited monthly fee correction through the service", async () => {
    const correction = {
      residentId: RESIDENT_ID,
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      changeType: "monthly_fee" as const,
      oldValue: 5000,
      newValue: 4500,
      delta: -500,
      reason: "Wrong fee entered during admission.",
      auditLogId: "aa0e8400-e29b-41d4-a716-446655440000",
      correctionRecordId: RESIDENT_ID,
      correctedAt: "2026-06-19T10:00:00.000Z",
    }
    const applyCorrection = vi.fn().mockResolvedValue(correction)

    vi.doMock("@/services/financial-corrections.service", () => ({
      FinancialCorrectionsService: {
        create: vi.fn().mockResolvedValue({ applyCorrection }),
      },
    }))

    const { POST } = await import("@/app/api/finance/corrections/route")
    const payload = {
      organizationId: TEST_ORGANIZATION_ID,
      residentId: RESIDENT_ID,
      changeType: "monthly_fee",
      newValue: 4500,
      reason: "Wrong fee entered during admission.",
    }
    const response = await POST(
      createJsonRequest("/api/finance/corrections", payload)
    )
    const body = await readApiResponse<typeof correction>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(applyCorrection).toHaveBeenCalledWith(payload)
  })
})
