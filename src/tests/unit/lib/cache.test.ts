import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildTenantCacheKey,
  clearCache,
  getCache,
  getOrSetCache,
  invalidateCacheByTag,
  invalidateCacheKey,
  invalidateTenantCache,
  setCache,
} from "@/lib/cache"

describe("cache utilities", () => {
  afterEach(() => {
    vi.useRealTimers()
    clearCache()
  })

  it("builds tenant-safe cache keys", () => {
    expect(
      buildTenantCacheKey({
        organizationId: "org-1",
        hostelId: "hostel-1",
        scope: "analytics",
        identifier: "dashboard",
      })
    ).toBe("tenant:org-1:hostel-1:analytics:dashboard")
  })

  it("stores, expires, and invalidates cache entries", async () => {
    vi.useFakeTimers()
    setCache("key-1", { ok: true }, { ttlMs: 1000, tags: ["tag-1"] })

    expect(getCache("key-1")).toEqual({ ok: true })

    vi.advanceTimersByTime(1001)
    expect(getCache("key-1")).toBeNull()

    const loaded = await getOrSetCache(
      "key-2",
      { ttlMs: 1000, tags: ["tag-2"] },
      async () => "loaded"
    )

    expect(loaded).toBe("loaded")
    expect(await getOrSetCache("key-2", { ttlMs: 1000 }, async () => "miss")).toBe(
      "loaded"
    )

    invalidateCacheKey("key-2")
    expect(getCache("key-2")).toBeNull()
  })

  it("invalidates entries by tag and tenant", () => {
    setCache("tenant:org-1:global:cms:settings", "one", {
      ttlMs: 1000,
      tags: ["cms"],
    })
    setCache("tenant:org-2:global:cms:settings", "two", {
      ttlMs: 1000,
      tags: ["cms-other"],
    })

    invalidateCacheByTag("cms")
    expect(getCache("tenant:org-1:global:cms:settings")).toBeNull()
    expect(getCache("tenant:org-2:global:cms:settings")).toBe("two")

    invalidateTenantCache("org-2")
    expect(getCache("tenant:org-2:global:cms:settings")).toBeNull()
  })
})
