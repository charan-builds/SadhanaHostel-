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

  it("keeps previous monthly fee statuses for quick admission opening balance", () => {
    const result = createResidentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      admissionNumber: "SBH-001",
      fullName: "Existing Resident",
      phone: "+91 90000 01001",
      openingMonthlyFees: [
        {
          periodMonth: "2026-05-01",
          status: "paid",
          amount: 6500,
          method: "cash",
        },
        {
          periodMonth: "2026-06-01",
          status: "not_paid",
          amount: 6500,
          method: "cash",
        },
      ],
    })

    expect(result.openingMonthlyFees).toEqual([
      expect.objectContaining({ periodMonth: "2026-05-01", status: "paid" }),
      expect.objectContaining({ periodMonth: "2026-06-01", status: "not_paid" }),
    ])
  })

  it("strips room assignment fields from resident admission input", () => {
    const result = createResidentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      admissionNumber: "SBH-001",
      fullName: "Resident Without Room",
      phone: "+91 90000 01001",
      roomId: "00000000-0000-4000-8000-000000000061",
      bedLabel: "A",
      allocatedFrom: "2026-06-01",
    })

    expect("roomId" in result).toBe(false)
    expect("bedLabel" in result).toBe(false)
    expect("allocatedFrom" in result).toBe(false)
  })

  it("rejects duplicate previous monthly fee periods", () => {
    expect(() =>
      createResidentSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        admissionNumber: "SBH-001",
        fullName: "Existing Resident",
        phone: "+91 90000 01001",
        openingMonthlyFees: [
          {
            periodMonth: "2026-05-01",
            status: "paid",
            amount: 6500,
            method: "cash",
          },
          {
            periodMonth: "2026-05-01",
            status: "not_paid",
            amount: 6500,
            method: "cash",
          },
        ],
      })
    ).toThrow(/Each previous month can only be recorded once/)
  })
})
