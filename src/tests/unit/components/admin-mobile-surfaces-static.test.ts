import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("admin mobile production surfaces", () => {
  it("keeps onboarding verification card-first on mobile with resident-scoped rejection reasons", () => {
    const source = readFileSync(
      join(root, "src/components/admin/residents/verification/admin-onboarding-verification-client.tsx"),
      "utf8"
    )

    expect(source).toContain("OnboardingResidentCard")
    expect(source).toContain("lg:hidden")
    expect(source).toContain("hidden overflow-x-auto rounded-lg border lg:block")
    expect(source).toContain("rejectionReasons[resident.id]")
  })

  it("keeps retired vacancy tracking off the removed endpoint and staff access mobile-safe", () => {
    const vacancy = readFileSync(
      join(root, "src/components/admin/admissions/admin-vacancy-client.tsx"),
      "utf8"
    )
    const staffAccess = readFileSync(
      join(root, "src/components/admin/staff-access/admin-staff-access-client.tsx"),
      "utf8"
    )

    expect(vacancy).toContain("HOSTEL_TOTAL_CAPACITY")
    expect(vacancy).toContain("useDashboardAnalytics")
    expect(vacancy).toContain("Vacancy tracking has been removed")
    expect(vacancy).not.toContain("useAdmissionsVacancy")
    expect(vacancy).not.toContain("/api/admissions/vacancy")

    expect(staffAccess).toContain("StaffAccessCard")
    expect(staffAccess).toContain("lg:hidden")
    expect(staffAccess).toContain("hidden overflow-x-auto rounded-lg border lg:block")
  })

  it("keeps resident payment QR generation lazy-loaded", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-payments-client.tsx"),
      "utf8"
    )

    expect(source).not.toContain('import QRCode from "qrcode"')
    expect(source).toContain('import("qrcode")')
    expect(source).toContain("module.default.toDataURL")
  })
})
