import { afterEach, describe, expect, it, vi } from "vitest"

import { versionedApiPath } from "@/lib/api/versioning"
import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/env"

describe("environment and API version helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("normalizes versioned API paths", () => {
    expect(versionedApiPath("analytics/dashboard")).toBe("/api/v1/analytics/dashboard")
    expect(versionedApiPath("/payments")).toBe("/api/v1/payments")
  })

  it("detects usable Supabase public configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "real-anon-key")

    expect(hasSupabaseConfig()).toBe(true)
    expect(getSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "real-anon-key",
    })
  })

  it("rejects placeholder Supabase values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://your-project-ref.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your-supabase-anon-key")

    expect(hasSupabaseConfig()).toBe(false)
    expect(() => getSupabaseConfig()).toThrow(/placeholder/i)
  })
})
