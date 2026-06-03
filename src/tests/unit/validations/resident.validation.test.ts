import { describe, expect, it } from "vitest"

import { HOSTEL_FEES } from "@/constants/hostel"
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

    expect(result.monthlyFeeAmount).toBe(HOSTEL_FEES.student)
    expect(result.securityDepositAmount).toBe(0)
    expect(result.residentType).toBe("student")
  })

  it("does not keep parent email in resident admission input", () => {
    const result = createResidentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      admissionNumber: "SBH-001",
      fullName: "New Resident",
      phone: "+91 90000 01001",
      parentEmail: "not-an-email",
    })

    expect("parentEmail" in result).toBe(false)
  })
})
