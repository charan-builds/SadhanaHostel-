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
import { isTenantQueryKey, queryKeys } from "@/lib/react-query/query-keys"

describe("cache utilities", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    clearCache()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
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

    await invalidateCacheKey("key-2")
    expect(getCache("key-2")).toBeNull()
  })

  it("invalidates entries by tag and tenant", async () => {
    setCache("tenant:org-1:global:cms:settings", "one", {
      ttlMs: 1000,
      tags: ["cms"],
    })
    setCache("tenant:org-2:global:cms:settings", "two", {
      ttlMs: 1000,
      tags: ["cms-other"],
    })

    await invalidateCacheByTag("cms")
    expect(getCache("tenant:org-1:global:cms:settings")).toBeNull()
    expect(getCache("tenant:org-2:global:cms:settings")).toBe("two")

    await invalidateTenantCache("org-2")
    expect(getCache("tenant:org-2:global:cms:settings")).toBeNull()
  })

  it("registers Redis cache indexes and deletes remote keys by tag when Redis is configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const command = JSON.parse(String(init?.body)) as unknown[]
      const [operation] = command

      if (operation === "GET") {
        return Response.json({ result: null })
      }

      if (operation === "SMEMBERS") {
        return Response.json({ result: ["tenant:org-1:global:cms:settings"] })
      }

      return Response.json({ result: "OK" })
    })

    await getOrSetCache(
      "tenant:org-1:global:cms:settings",
      { ttlMs: 1000, tags: ["tenant:org-1:cms"] },
      async () => "loaded"
    )
    await invalidateCacheByTag("tenant:org-1:cms")

    const commands = fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    )

    expect(commands).toContainEqual([
      "SADD",
      "cache-tag:tenant:org-1:cms",
      "tenant:org-1:global:cms:settings",
    ])
    expect(commands).toContainEqual([
      "SADD",
      "cache-tenant:org-1",
      "tenant:org-1:global:cms:settings",
    ])
    expect(commands).toContainEqual([
      "DEL",
      "tenant:org-1:global:cms:settings",
    ])
    expect(commands).toContainEqual(["DEL", "cache-tag:tenant:org-1:cms"])
  })

  it("keeps realtime invalidation query keys tenant and hostel scoped", () => {
    const orgOneHostelOne = { organizationId: "org-1", hostelId: "hostel-1" }
    const orgTwoHostelOne = { organizationId: "org-2", hostelId: "hostel-1" }
    const orgOneGlobal = { organizationId: "org-1", hostelId: null }

    expect(queryKeys.payments.all(orgOneHostelOne)).not.toEqual(
      queryKeys.payments.all(orgTwoHostelOne)
    )
    expect(queryKeys.analytics.dashboard(orgOneHostelOne)).toEqual([
      "tenant",
      "org-1",
      "hostel-1",
      "analytics",
      "dashboard",
    ])
    expect(queryKeys.residents.all(orgOneGlobal)).toEqual([
      "tenant",
      "org-1",
      "global",
      "residents",
    ])
    expect(isTenantQueryKey(queryKeys.payments.all(orgOneHostelOne), "org-1")).toBe(true)
    expect(isTenantQueryKey(queryKeys.payments.all(orgTwoHostelOne), "org-1")).toBe(false)
  })
})
