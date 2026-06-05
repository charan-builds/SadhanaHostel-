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

  it("rejects cross-site API mutations before refreshing Supabase auth cookies", async () => {
    const updateSession = vi.fn()

    vi.doMock("@/lib/supabase/middleware", () => ({
      updateSession,
    }))

    const { proxy } = await import("@/proxy")
    const response = await proxy(
      new NextRequest("http://localhost/api/payments/verify", {
        method: "POST",
        headers: {
          cookie: "sb-test-auth-token=token",
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "CSRF_ORIGIN_BLOCKED",
        message: "Cross-site mutation blocked.",
      },
    })
    expect(updateSession).not.toHaveBeenCalled()
  })
})
