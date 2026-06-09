import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(path: string) {
  return readFileSync(join(root, path), "utf8")
}

describe("hostel rules management wiring", () => {
  it("exposes rules and policies from admin settings with CRUD, search, filters, and ordering", () => {
    const adminClient = source(
      "src/components/admin/settings/admin-hostel-rules-client.tsx"
    )
    const adminPage = source("src/app/(admin)/admin/settings/rules/page.tsx")
    const sidebar = source("src/components/admin/layout/admin-sidebar.tsx")

    expect(adminPage).toContain("AdminHostelRulesClient")
    expect(sidebar).toContain("Rules & Policies")
    expect(adminClient).toContain("Add rule")
    expect(adminClient).toContain("Edit")
    expect(adminClient).toContain("Delete")
    expect(adminClient).toContain("Disable")
    expect(adminClient).toContain("Enable")
    expect(adminClient).toContain("Search")
    expect(adminClient).toContain("Filter rules by category")
    expect(adminClient).toContain("useReorderHostelRules")
    expect(adminClient).toContain("displayOrder")
  })

  it("wires public, resident, dashboard, and onboarding surfaces to tenant rules", () => {
    const publicCms = source("src/lib/cms/public-cms.ts")
    const termsPage = source("src/components/public/terms-page-content.tsx")
    const residentRules = source("src/components/resident/resident-rules-client.tsx")
    const residentDashboard = source("src/components/resident/resident-dashboard-client.tsx")
    const onboarding = source(
      "src/components/resident/onboarding/resident-onboarding-client.tsx"
    )
    const navigation = source("src/constants/navigation.ts")

    expect(publicCms).toContain("HostelRulesService.createPublic")
    expect(publicCms).toContain("hostelRules")
    expect(termsPage).toContain("Rules & policies")
    expect(termsPage).toContain("Search rules")
    expect(termsPage).toContain("aria-expanded")
    expect(residentRules).toContain("useResidentHostelRules")
    expect(residentRules).toContain("Rules Updated")
    expect(residentRules).toContain("useAcceptHostelRules")
    expect(residentDashboard).toContain("Rules Updated")
    expect(residentDashboard).toContain("/resident/rules")
    expect(onboarding).toContain("useResidentHostelRules")
    expect(onboarding).toContain("I have read and agree")
    expect(navigation).toContain("/resident/rules")
  })

  it("uses dedicated API, SDK, hooks, repository, and service contracts", () => {
    const sdk = source("src/sdk/hostel-rules.sdk.ts")
    const hooks = source("src/hooks/use-hostel-rules.ts")
    const service = source("src/services/hostel-rules.service.ts")
    const repository = source("src/repositories/hostel-rules.repository.ts")
    const route = source("src/app/api/hostel-rules/route.ts")
    const acceptanceRoute = source("src/app/api/hostel-rules/acceptance/route.ts")

    expect(sdk).toContain("/api/hostel-rules")
    expect(sdk).toContain("/api/hostel-rules/acceptance")
    expect(hooks).toContain("useHostelRules")
    expect(hooks).toContain("useResidentHostelRules")
    expect(service).toContain("computeRulesVersion")
    expect(service).toContain("acceptCurrentRules")
    expect(repository).toContain('.from("hostel_rules")')
    expect(repository).toContain('.from("hostel_rule_acceptances")')
    expect(route).toContain("createRule")
    expect(acceptanceRoute).toContain("getResidentRulesStatus")
  })
})
