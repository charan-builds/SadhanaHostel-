import { describe, expect, it } from "vitest"

import { leadIdMutationSchema } from "@/validations/admission.validation"
import { TEST_ORGANIZATION_ID } from "@/tests/fixtures"

const LEAD_ID = "00000000-0000-4000-8000-000000000061"

describe("admission validation", () => {
  it("requires tenant scope when removing a lead", () => {
    expect(
      leadIdMutationSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        leadId: LEAD_ID,
      })
    ).toEqual({
      organizationId: TEST_ORGANIZATION_ID,
      leadId: LEAD_ID,
    })

    expect(() =>
      leadIdMutationSchema.parse({
        leadId: LEAD_ID,
      })
    ).toThrow()
  })
})
