import { describe, expect, it } from "vitest"

import { isResidentLimitedAccessPath } from "@/lib/auth/resident-onboarding-access"

describe("resident limited onboarding access paths", () => {
  it("allows incomplete residents to reach onboarding, payments, and support", () => {
    expect(isResidentLimitedAccessPath("/resident/onboarding")).toBe(true)
    expect(isResidentLimitedAccessPath("/resident/payments?status=pending")).toBe(true)
    expect(isResidentLimitedAccessPath("/resident/support/payment")).toBe(true)
  })

  it("keeps the rest of the resident portal behind onboarding completion", () => {
    expect(isResidentLimitedAccessPath("/resident/dashboard")).toBe(false)
    expect(isResidentLimitedAccessPath("/resident/profile")).toBe(false)
    expect(isResidentLimitedAccessPath("/resident/leave")).toBe(false)
  })
})
