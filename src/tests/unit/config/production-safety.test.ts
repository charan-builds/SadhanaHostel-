import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getProductionSafetySnapshot,
  isProductionSafetyMode,
} from "@/config/production-safety"

describe("production safety launch-mode detection", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("blocks when either launch mode is production", () => {
    vi.stubEnv("LAUNCH_MODE", "staging")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    expect(isProductionSafetyMode()).toBe(true)
    expect(getProductionSafetySnapshot()).toMatchObject({
      launchMode: "staging",
      publicLaunchMode: "production",
      effectiveMode: "staging",
      production: true,
    })
  })

  it("allows explicit staging mode", () => {
    vi.stubEnv("LAUNCH_MODE", "staging")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "staging")

    expect(getProductionSafetySnapshot()).toMatchObject({
      launchMode: "staging",
      publicLaunchMode: "staging",
      effectiveMode: "staging",
      production: false,
    })
  })
})
