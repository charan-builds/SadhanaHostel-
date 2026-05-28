import { describe, expect, it } from "vitest"

import {
  DEMO_DATA_RESET_CONFIRMATION,
  demoDataResetSchema,
} from "@/validations/operations.validation"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("operations validation", () => {
  it("allows dry-run demo data reset previews without confirmation", () => {
    const result = demoDataResetSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      dryRun: true,
    })

    expect(result).toMatchObject({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      dryRun: true,
    })
  })

  it("requires the exact confirmation phrase for destructive demo data resets", () => {
    expect(() =>
      demoDataResetSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: false,
        confirmation: "reset demo data",
      })
    ).toThrow(/RESET DEMO DATA/)

    expect(
      demoDataResetSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: false,
        confirmation: DEMO_DATA_RESET_CONFIRMATION,
      })
    ).toMatchObject({
      dryRun: false,
      confirmation: DEMO_DATA_RESET_CONFIRMATION,
    })
  })
})
