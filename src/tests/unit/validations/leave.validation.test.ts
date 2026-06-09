import { describe, expect, it } from "vitest"

import {
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
} from "@/validations/leave.validation"

import { RESIDENT_ID, TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("leave validation", () => {
  it("accepts a valid leave request", () => {
    const result = createLeaveRequestSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      fullName: "Resident User",
      mobileNumber: "90000 00002",
      whatsappNumber: "90000 00002",
      fromDate: "2026-06-01",
      toDate: "2026-06-03",
      reason: "Family function",
      travelMode: "bus",
    })

    expect(result.fromDate).toBe("2026-06-01")
    expect(result.mobileNumber).toBe("+919000000002")
    expect(result.travelMode).toBe("bus")
  })

  it("rejects leave requests ending before they start", () => {
    const result = createLeaveRequestSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      fullName: "Resident User",
      mobileNumber: "90000 00002",
      whatsappNumber: "90000 00002",
      fromDate: "2026-06-03",
      toDate: "2026-06-01",
      reason: "Family function",
    })

    expect(result.success).toBe(false)
  })

  it("requires student contact fields for simplified leave requests", () => {
    const result = createLeaveRequestSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      fromDate: "2026-06-01",
      toDate: "2026-06-03",
      reason: "Family function",
    })

    expect(result.success).toBe(false)
  })

  it("restricts review status to approval or rejection", () => {
    const result = reviewLeaveRequestSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      leaveRequestId: "00000000-0000-4000-8000-000000000061",
      status: "returned",
    })

    expect(result.success).toBe(false)
  })
})
