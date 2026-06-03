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
  aadhaar_document_id: "doc-aadhaar",
  profile_image_document_id: "doc-photo",
  student_id_document_id: "doc-student",
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

  it("reports missing required identity and document fields", () => {
    const requirements = getResidentOnboardingRequirements({
      ...baseResident,
      date_of_birth: null,
      aadhaar_document_id: null,
      student_id_document_id: null,
      onboarding_status: "documents_pending",
    })

    expect(requirements.canSubmitForVerification).toBe(false)
    expect(requirements.missing).toEqual(
      expect.arrayContaining(["date_of_birth", "aadhaar_document", "student_id"])
    )
    expect(requirements.completionPercent).toBeLessThan(100)
  })

  it("requires hostel rules acceptance before self-onboarding completion", () => {
    const draftResident: ResidentWithOnboarding = {
      ...baseResident,
      status: "draft",
      onboarding_status: "documents_pending",
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
