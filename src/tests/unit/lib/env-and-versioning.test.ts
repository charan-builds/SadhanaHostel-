import { afterEach, describe, expect, it, vi } from "vitest"

import { getPublicEnv } from "@/config/env"
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

  it("accepts optional Google Search Console verification token in public env", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sadhanaboyshostel.in")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://real-project.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "real-anon-key")
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", "google-site-verification-token")

    expect(getPublicEnv()).toEqual(
      expect.objectContaining({
        NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "google-site-verification-token",
      })
    )
  })
})
