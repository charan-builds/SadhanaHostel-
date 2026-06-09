import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(path: string) {
  return readFileSync(join(root, path), "utf8")
}

describe("permission hardening static guards", () => {
  it("gates admin support alert polling by resident-management permission", () => {
    const desktopSidebar = source("src/components/admin/layout/admin-sidebar.tsx")
    const mobileSidebar = source("src/components/admin/layout/admin-mobile-sidebar.tsx")

    for (const code of [desktopSidebar, mobileSidebar]) {
      expect(code).toContain("anyRoleHasPermission")
      expect(code).toContain('"residents.manage"')
      expect(code).toContain("canManageSupport ? organizationId")
      expect(code).toContain("useSupportRequests")
      expect(code).toContain("useOperationalAlerts")
    }
  })

  it("keeps admin support APIs behind resident-management permission", () => {
    const supportService = source("src/services/support.service.ts")
    const updateStart = supportService.indexOf("async updateRequest")
    const alertsStart = supportService.indexOf("async getOperationalAlerts")
    const scopeStart = supportService.indexOf("private async resolveSupportScope")

    expect(supportService).not.toContain("requireRole(ADMIN_PORTAL_ROLES)")
    expect(supportService.indexOf('requirePermission("residents.manage")', updateStart)).toBeGreaterThan(updateStart)
    expect(supportService.indexOf('requirePermission("residents.manage")', alertsStart)).toBeGreaterThan(alertsStart)
    expect(supportService.indexOf('anyRoleHasPermission(context.roles, "residents.manage")', scopeStart)).toBeGreaterThan(scopeStart)
  })
})
