import { describe, expect, it } from "vitest"

import {
  createPaymentSchema,
  generateMonthlyFeeSchema,
  paymentSettingsSchema,
  submitUpiPaymentSchema,
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

  it("coerces multipart boolean payment flags from true and false strings", () => {
    const result = submitUpiPaymentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 6500,
      transactionId: "upi123456789",
      idempotencyKey: "payment-idempotency-key",
      isAdvance: "true",
      isPartial: "false",
    })

    expect(result.isAdvance).toBe(true)
    expect(result.isPartial).toBe(false)
  })

  it("rejects unsafe multipart boolean payment flags", () => {
    const result = submitUpiPaymentSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 6500,
      transactionId: "upi123456789",
      idempotencyKey: "payment-idempotency-key",
      isAdvance: "yes",
    })

    expect(result.success).toBe(false)
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

  it("normalizes and validates manual UPI transaction references", () => {
    const result = submitUpiPaymentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 6500,
      transactionId: "upi123456789",
      idempotencyKey: "payment-idempotency-key",
    })

    expect(result.transactionId).toBe("UPI123456789")
  })

  it("allows screenshot-only UPI submissions without a resident-entered transaction reference", () => {
    const result = submitUpiPaymentSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 6500,
      transactionId: "",
      idempotencyKey: "payment-idempotency-key",
    })

    expect(result.transactionId).toBeUndefined()
  })

  it("rejects unsafe UPI references with spaces", () => {
    const result = submitUpiPaymentSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      residentId: RESIDENT_ID,
      amount: 6500,
      transactionId: "UPI REF 123",
      idempotencyKey: "payment-idempotency-key",
    })

    expect(result.success).toBe(false)
  })

  it("requires a UPI ID or QR image for active UPI payment settings", () => {
    const result = paymentSettingsSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      paymentMethod: "upi",
      accountName: "Sadhana Boys Hostel",
    })

    expect(result.success).toBe(false)
  })

  it("validates finance security settings for manual UPI accounts", () => {
    const result = paymentSettingsSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      paymentMethod: "upi",
      accountName: "Sadhana Boys Hostel",
      upiId: "sadhanahostel@ibl",
      requireUtr: true,
      requireScreenshot: true,
      allowPartialPayment: false,
      allowAdvancePayment: true,
      minPaymentAmount: 100,
      utrRegex: "^[A-Z0-9]{8,64}$",
      duplicateDetectionStrictness: "strict",
    })

    expect(result.success).toBe(true)
    expect(result.data?.upiId).toBe("sadhanahostel@ibl")
    expect(result.data?.allowPartialPayment).toBe(false)
  })

  it("rejects invalid UPI IDs in payment settings", () => {
    const result = paymentSettingsSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      paymentMethod: "upi",
      accountName: "Sadhana Boys Hostel",
      upiId: "not a upi id",
    })

    expect(result.success).toBe(false)
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
