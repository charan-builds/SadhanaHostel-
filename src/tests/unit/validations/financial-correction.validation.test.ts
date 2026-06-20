import { describe, expect, it } from "vitest"

import {
  financialCorrectionResultSchema,
  financialCorrectionSchema,
} from "@/validations/financial-correction.validation"
import { RESIDENT_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("financial correction validation", () => {
  it("accepts reasoned monthly fee and advance balance corrections", () => {
    expect(
      financialCorrectionSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        residentId: RESIDENT_ID,
        changeType: "monthly_fee",
        newValue: 4500,
        reason: "Correcting the admission fee.",
      })
    ).toMatchObject({
      changeType: "monthly_fee",
      newValue: 4500,
    })

    expect(
      financialCorrectionSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        residentId: RESIDENT_ID,
        changeType: "advance_balance",
        newValue: 20000,
        reason: "Correcting the opening advance.",
      })
    ).toMatchObject({
      changeType: "advance_balance",
      newValue: 20000,
    })
  })

  it("rejects zero monthly fees and missing audit reasons", () => {
    expect(() =>
      financialCorrectionSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        residentId: RESIDENT_ID,
        changeType: "monthly_fee",
        newValue: 0,
        reason: "Valid reason.",
      })
    ).toThrow()

    expect(() =>
      financialCorrectionSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        residentId: RESIDENT_ID,
        changeType: "advance_balance",
        newValue: 1000,
        reason: "bad",
      })
    ).toThrow()
  })

  it("accepts database timestamptz offsets in correction results", () => {
    expect(
      financialCorrectionResultSchema.parse({
        residentId: RESIDENT_ID,
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: "550e8400-e29b-41d4-a716-446655440001",
        changeType: "advance_balance",
        oldValue: 10000,
        newValue: 10001,
        delta: 1,
        reason: "Correcting the opening advance.",
        auditLogId: "550e8400-e29b-41d4-a716-446655440002",
        correctionRecordId: "550e8400-e29b-41d4-a716-446655440003",
        correctedAt: "2026-06-19T17:21:26.500911+00:00",
      })
    ).toMatchObject({
      changeType: "advance_balance",
      correctedAt: "2026-06-19T17:21:26.500911+00:00",
    })
  })
})
