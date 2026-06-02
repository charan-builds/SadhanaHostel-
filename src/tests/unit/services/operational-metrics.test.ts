import { describe, expect, it } from "vitest"

import {
  buildResidentLifecycleSummary,
  isResidentEligibleForBilling,
  isResidentEligibleForOccupancy,
} from "@/services/analytics/operational-metrics"

describe("operational dashboard resident lifecycle metrics", () => {
  it("separates registered residents from active occupancy lifecycle", () => {
    const summary = buildResidentLifecycleSummary([
      {
        status: "draft",
        onboarding_status: "invited",
        user_id: null,
      },
      {
        status: "active",
        onboarding_status: "verified",
        is_active: true,
        user_id: "user-1",
      },
      {
        status: "suspended",
        onboarding_status: "suspended",
        user_id: "user-2",
      },
      {
        status: "checked_out",
        onboarding_status: "verified",
        is_active: false,
        user_id: "user-4",
        checkout_on: "2026-05-20",
      },
    ])

    expect(summary).toEqual({
      registeredResidents: 4,
      activeResidents: 1,
      draftResidents: 1,
      onboardingResidents: 1,
      verifiedResidents: 1,
      suspendedResidents: 1,
      checkedOutResidents: 1,
      archivedResidents: 0,
      pendingVerification: 0,
    })
  })

  it("classifies document and verification backlog for owner-facing alerts", () => {
    const summary = buildResidentLifecycleSummary([
      { status: "draft", onboarding_status: "documents_pending" },
      { status: "draft", onboarding_status: "verification_pending" },
      { status: "draft", onboarding_status: "rejected" },
      { status: "active", onboarding_status: "verified", is_active: true, user_id: "user-1" },
    ])

    expect(summary.registeredResidents).toBe(4)
    expect(summary.onboardingResidents).toBe(3)
    expect(summary.pendingVerification).toBe(3)
    expect(summary.activeResidents).toBe(1)
    expect(summary.verifiedResidents).toBe(1)
  })

  it("keeps occupancy verified while allowing portal-linked residents into billing", () => {
    const operationalResident = {
      status: "active",
      onboarding_status: "verified",
      is_active: true,
      user_id: "user-1",
      checkout_on: null,
    }

    expect(isResidentEligibleForOccupancy(operationalResident)).toBe(true)
    expect(isResidentEligibleForBilling(operationalResident)).toBe(true)

    expect(
      isResidentEligibleForBilling({
        ...operationalResident,
        status: "draft",
      })
    ).toBe(true)
    expect(
      isResidentEligibleForBilling({
        ...operationalResident,
        onboarding_status: "verification_pending",
      })
    ).toBe(true)
    expect(
      isResidentEligibleForBilling({
        ...operationalResident,
        user_id: null,
      })
    ).toBe(false)
    expect(
      isResidentEligibleForBilling({
        ...operationalResident,
        onboarding_status: "rejected",
      })
    ).toBe(false)
    expect(
      isResidentEligibleForOccupancy({
        ...operationalResident,
        user_id: null,
      })
    ).toBe(false)
    expect(
      isResidentEligibleForOccupancy({
        ...operationalResident,
        checkout_on: "2026-05-20",
      })
    ).toBe(false)
  })
})
