import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("operations admin surfaces", () => {
  it("fetches all active complaint statuses for daily operations", () => {
    const operationsCenter = readFileSync(
      join(root, "src/components/admin/operations/operations-center-client.tsx"),
      "utf8"
    )
    const intelligence = readFileSync(
      join(root, "src/components/admin/operations/competitive-intelligence-client.tsx"),
      "utf8"
    )

    for (const source of [operationsCenter, intelligence]) {
      expect(source).toContain('status: "open"')
      expect(source).toContain('status: "in_progress"')
      expect(source).toContain('status: "waiting_on_resident"')
      expect(source).toContain("uniqueSupportRequests")
    }
  })

  it("keeps operations surfaces off the retired vacancy endpoint", () => {
    const operationsCenter = readFileSync(
      join(root, "src/components/admin/operations/operations-center-client.tsx"),
      "utf8"
    )
    const intelligence = readFileSync(
      join(root, "src/components/admin/operations/competitive-intelligence-client.tsx"),
      "utf8"
    )
    const admissionsHooks = readFileSync(
      join(root, "src/hooks/use-admissions.ts"),
      "utf8"
    )

    for (const source of [operationsCenter, intelligence]) {
      expect(source).not.toContain("useAdmissionsVacancy")
      expect(source).not.toContain("/api/admissions/vacancy")
      expect(source).toContain("useDashboardAnalytics")
      expect(source).toContain("useOwnerAnalytics")
    }

    expect(admissionsHooks).toContain("enabled: hostelModules.vacancy")
    expect(admissionsHooks).toContain(
      "enabled: Boolean(params.organizationId && hostelModules.vacancy)"
    )
  })

  it("keeps cross-permission operations routes guarded in server navigation", () => {
    const guard = readFileSync(
      join(root, "src/lib/auth/server-route-guard.ts"),
      "utf8"
    )

    expect(guard).toContain('pathname.startsWith("/admin/operations/identity-repair")')
    expect(guard).toContain('pathname.startsWith("/admin/operations/reset-demo-data")')
    expect(guard).toContain('pathname.startsWith("/admin/operations")) return "admin.dashboard.view"')
  })
})
