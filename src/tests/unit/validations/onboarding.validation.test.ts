import { describe, expect, it } from "vitest"

import {
  onboardingProfileBaseSchema,
  onboardingProfileFormSchema,
  onboardingProfileSchema,
  onboardingSubmitSchema,
} from "@/validations/onboarding.validation"
import { TEST_ORGANIZATION_ID } from "@/tests/fixtures"

const adultBirthDate = "2000-01-01"
const underageBirthDate = "2020-01-01"

function onboardingProfile(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: TEST_ORGANIZATION_ID,
    fullName: "Resident User",
    dateOfBirth: adultBirthDate,
    phone: "+919000000002",
    email: "resident.test@sadhanahostel.example",
    parentPhone: "+919000000003",
    emergencyContactPhone: "+919000000004",
    permanentAddress: "Sadhana Boys Hostel, Main Road, Hyderabad",
    ...overrides,
  }
}

describe("onboarding validation schemas", () => {
  it("derives form schemas from the non-refined base schema before applying refinements", () => {
    expect(() => {
      onboardingProfileBaseSchema.omit({ organizationId: true })
    }).not.toThrow()

    expect(
      onboardingProfileFormSchema.parse(
        onboardingProfile({ organizationId: undefined })
      )
    ).toMatchObject({
      fullName: "Resident User",
      phone: "+919000000002",
    })
  })

  it("keeps resident age rules on both API and client form schemas", () => {
    expect(() =>
      onboardingProfileSchema.parse(
        onboardingProfile({ dateOfBirth: underageBirthDate })
      )
    ).toThrow(/at least 15 years old/)

    expect(() =>
      onboardingProfileFormSchema.parse(
        onboardingProfile({
          organizationId: undefined,
          dateOfBirth: underageBirthDate,
        })
      )
    ).toThrow(/at least 15 years old/)
  })

  it("keeps resident email optional while requiring father and mother phone numbers", () => {
    expect(
      onboardingProfileSchema.parse(onboardingProfile({ email: "" }))
    ).toMatchObject({
      email: undefined,
      parentPhone: "+919000000003",
      emergencyContactPhone: "+919000000004",
    })

    expect(() =>
      onboardingProfileSchema.parse(onboardingProfile({ parentPhone: "" }))
    ).toThrow()

    expect(() =>
      onboardingProfileSchema.parse(onboardingProfile({ emergencyContactPhone: "" }))
    ).toThrow()
  })

  it("evaluates the resident onboarding client module without refined-schema omit crashes", async () => {
    await expect(
      import("@/components/resident/onboarding/resident-onboarding-client")
    ).resolves.toHaveProperty("ResidentOnboardingClient")
  })

  it("requires residents to accept hostel rules before submitting onboarding", () => {
    expect(() =>
      onboardingSubmitSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
      })
    ).toThrow(/Accept hostel rules/)

    expect(
      onboardingSubmitSchema.parse({
        organizationId: TEST_ORGANIZATION_ID,
        rulesAccepted: true,
      })
    ).toEqual({
      organizationId: TEST_ORGANIZATION_ID,
      rulesAccepted: true,
    })
  })
})
