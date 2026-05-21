import { afterEach, describe, expect, it, vi } from "vitest"

describe("health API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/lib/supabase/admin")
  })

  it("returns live status without dependency checks", async () => {
    const { GET } = await import("@/app/api/health/live/route")
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe("ok")
  })

  it("returns ready when environment, cache, database, and storage are healthy", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createSupabaseAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ error: null }),
          })),
        })),
        storage: {
          listBuckets: vi.fn().mockResolvedValue({ data: [], error: null }),
        },
      })),
    }))

    const { GET } = await import("@/app/api/health/ready/route")
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.checks.database.ok).toBe(true)
    expect(body.data.checks.storage.ok).toBe(true)
  })

  it("returns not ready when a dependency check fails", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createSupabaseAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ error: { message: "db down" } }),
          })),
        })),
        storage: {
          listBuckets: vi.fn().mockResolvedValue({ data: [], error: null }),
        },
      })),
    }))

    const { GET } = await import("@/app/api/health/ready/route")
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.data.checks.database.ok).toBe(false)
  })
})
