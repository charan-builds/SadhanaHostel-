import { describe, expect, it } from "vitest"

import {
  defaultTenantFeatureFlags,
  isTenantFeatureEnabled,
  resolveTenantFeatureFlags,
  tenantFeatureFlagKeys,
} from "@/lib/tenant/feature-flags"

describe("tenant feature flags", () => {
  it("enables production feature defaults when settings are empty", () => {
    expect(resolveTenantFeatureFlags(null)).toEqual(defaultTenantFeatureFlags)
    expect(tenantFeatureFlagKeys).toContain("globalSearch")
    expect(tenantFeatureFlagKeys).toContain("notificationIntelligence")
    expect(tenantFeatureFlagKeys).toContain("ownerDashboardV3")
  })

  it("reads featureFlags overrides without mutating unknown settings", () => {
    const flags = resolveTenantFeatureFlags({
      featureFlags: {
        globalSearch: false,
        gatePass: false,
        unknownFeature: false,
      },
      operationalControls: {
        demoMode: true,
      },
    })

    expect(flags.globalSearch).toBe(false)
    expect(flags.gatePass).toBe(false)
    expect(flags.visitorManagement).toBe(true)
    expect(isTenantFeatureEnabled({ featureFlags: { globalSearch: false } }, "globalSearch")).toBe(
      false
    )
  })

  it("supports legacy settings.features while preferring featureFlags", () => {
    const flags = resolveTenantFeatureFlags({
      features: {
        aiOperations: false,
        publicAdmissions: false,
      },
      featureFlags: {
        publicAdmissions: true,
      },
    })

    expect(flags.aiOperations).toBe(false)
    expect(flags.publicAdmissions).toBe(true)
  })
})
