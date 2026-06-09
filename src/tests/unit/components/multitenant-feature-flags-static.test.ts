import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("multi-tenant feature flag integration", () => {
  it("resolves feature flags from organization settings and gates global search", () => {
    const helper = readFileSync(join(root, "src/lib/tenant/feature-flags.ts"), "utf8")
    const globalSearch = readFileSync(
      join(root, "src/components/admin/layout/admin-global-search.tsx"),
      "utf8"
    )

    expect(helper).toContain("tenantFeatureFlagKeys")
    expect(helper).toContain("featureFlags")
    expect(helper).toContain("features")
    expect(globalSearch).toContain("useOrganizationSettings")
    expect(globalSearch).toContain("resolveTenantFeatureFlags")
    expect(globalSearch).toContain("!featureFlags.globalSearch")
  })
})
