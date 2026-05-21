import { NextRequest, NextResponse } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("proxy route protection", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/lib/supabase/middleware")
  })

  it("redirects unauthenticated admin requests before rendering", async () => {
    vi.doMock("@/lib/supabase/middleware", () => ({
      updateSession: vi.fn().mockResolvedValue({
        response: NextResponse.next(),
        user: null,
      }),
    }))

    const { proxy } = await import("@/proxy")
    const response = await proxy(
      new NextRequest("http://localhost/admin/dashboard?tab=payments")
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/login")
    expect(response.headers.get("location")).toContain(
      encodeURIComponent("/admin/dashboard?tab=payments")
    )
  })

  it("allows authenticated protected requests to continue to server layout authorization", async () => {
    vi.doMock("@/lib/supabase/middleware", () => ({
      updateSession: vi.fn().mockResolvedValue({
        response: NextResponse.next(),
        user: { id: "user-id" },
      }),
    }))

    const { proxy } = await import("@/proxy")
    const response = await proxy(
      new NextRequest("http://localhost/resident/dashboard")
    )

    expect(response.status).toBe(200)
  })
})
