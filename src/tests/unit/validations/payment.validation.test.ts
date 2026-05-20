import { describe, expect, it } from "vitest"

import {
  createPaymentSchema,
  generateMonthlyFeeSchema,
  verifyPaymentSchema,
} from "@/validations/payment.validation"

import { PAYMENT_ID, RESIDENT_ID, TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("payment validation", () => {
  it("defaults payment creation to UPI-only workflow", () => {
    const result = createPaymentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 6500,
    })

    expect(result.method).toBe("upi")
    expect(result.isAdvance).toBe(false)
    expect(result.isPartial).toBe(false)
  })

  it("rejects non-UPI payment creation during the UPI-first phase", () => {
    const result = createPaymentSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 6500,
      method: "cash",
    })

    expect(result.success).toBe(false)
  })

  it("validates payment verification input", () => {
    expect(
      verifyPaymentSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).toEqual({
      organizationId: TEST_ORGANIZATION_ID,
      paymentId: PAYMENT_ID,
    })
  })

  it("requires fee month to use the first day of the month", () => {
    const result = generateMonthlyFeeSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      periodMonth: "2026-05-20",
      dueDate: "2026-05-10",
      baseAmount: 6500,
    })

    expect(result.success).toBe(false)
  })
})
