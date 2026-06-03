import { describe, expect, it } from "vitest"

import type { ResidentWithOnboarding } from "@/repositories/residents.repository"
import { HOSTEL_RULES_VERSION } from "@/constants/hostel"
import {
  getResidentOnboardingRequirements,
  hasAcceptedCurrentHostelRules,
  isResidentOperationallyVerified,
} from "@/services/onboarding/resident-onboarding.policy"

const baseResident = {
  id: "resident-1",
  organization_id: "org-1",
  hostel_id: "hostel-1",
  admission_number: "SBH-001",
  full_name: "Arjun Kumar",
  date_of_birth: "2004-01-01",
  phone: "9876543210",
  parent_name: "Ramesh Kumar",
  parent_phone: "9876543211",
  emergency_contact_name: "Ramesh Kumar",
  emergency_contact_phone: "9876543211",
  permanent_address: "Hyderabad, Telangana",
  aadhaar_document_id: null,
  profile_image_document_id: null,
  student_id_document_id: null,
  status: "active",
  is_active: true,
  user_id: "auth-user-1",
  checkout_on: null,
  onboarding_status: "verified",
} as ResidentWithOnboarding

describe("resident onboarding policy", () => {
  it("allows operations only when resident status and onboarding status are verified", () => {
    expect(isResidentOperationallyVerified(baseResident)).toBe(true)
    expect(
      isResidentOperationallyVerified({
        ...baseResident,
        onboarding_status: "verification_pending",
      })
    ).toBe(false)
    expect(
      isResidentOperationallyVerified({
        ...baseResident,
        status: "draft",
      })
    ).toBe(false)
    expect(
      isResidentOperationallyVerified({
        ...baseResident,
        user_id: null,
      })
    ).toBe(false)
  })

  it("reports missing required profile fields without requiring document uploads", () => {
    const requirements = getResidentOnboardingRequirements({
      ...baseResident,
      date_of_birth: null,
      parent_phone: null,
      emergency_contact_phone: null,
      aadhaar_document_id: null,
      student_id_document_id: null,
      onboarding_status: "profile_incomplete",
    })

    expect(requirements.canSubmitForVerification).toBe(false)
    expect(requirements.missing).toContain("date_of_birth")
    expect(requirements.missing).toContain("father_phone")
    expect(requirements.missing).toContain("mother_phone")
    expect(requirements.missing as string[]).not.toContain("aadhaar_document")
    expect(requirements.missing as string[]).not.toContain("student_id")
    expect(requirements.completionPercent).toBeLessThan(100)
  })

  it("requires hostel rules acceptance before self-onboarding completion", () => {
    const draftResident: ResidentWithOnboarding = {
      ...baseResident,
      status: "draft",
      onboarding_status: "profile_incomplete",
      metadata: {},
    }

    expect(getResidentOnboardingRequirements(draftResident).missing).toContain(
      "rules_acceptance"
    )

    const acceptedResident: ResidentWithOnboarding = {
      ...draftResident,
      metadata: {
        onboarding: {
          hostelRulesAcceptance: {
            accepted: true,
            version: HOSTEL_RULES_VERSION,
            acceptedAt: "2026-06-02T00:00:00.000Z",
          },
        },
      },
    }

    expect(hasAcceptedCurrentHostelRules(acceptedResident)).toBe(true)
    expect(getResidentOnboardingRequirements(acceptedResident).missing).not.toContain(
      "rules_acceptance"
    )
  })
})
