import { describe, expect, it } from "vitest"

import { createResidentSchema } from "@/validations/resident.validation"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("resident validation", () => {
  it("normalizes resident financial defaults", () => {
    const result = createResidentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      admissionNumber: "SBH-001",
      fullName: "New Resident",
      phone: "+91 90000 01001",
    })

    expect(result.monthlyFeeAmount).toBe(0)
    expect(result.securityDepositAmount).toBe(0)
    expect(result.residentType).toBe("student")
  })

  it("rejects invalid parent email", () => {
    const result = createResidentSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      admissionNumber: "SBH-001",
      fullName: "New Resident",
      phone: "+91 90000 01001",
      parentEmail: "not-an-email",
    })

    expect(result.success).toBe(false)
  })
})
