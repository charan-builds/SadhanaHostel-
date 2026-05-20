import { afterEach, describe, expect, it, vi } from "vitest"

import { createJsonRequest, readApiResponse } from "@/tests/helpers"

describe("auth API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/auth.service")
  })

  it("logs in through AuthService", async () => {
    const login = vi.fn().mockResolvedValue({
      authenticated: true,
      redirectTo: "/admin/dashboard",
    })

    vi.doMock("@/services/auth.service", () => ({
      AuthService: {
        create: vi.fn().mockResolvedValue({ login }),
      },
    }))

    const { POST } = await import("@/app/api/auth/login/route")
    const response = await POST(
      createJsonRequest("/api/auth/login", {
        email: "admin.test@sadhanahostel.example",
        password: "password123",
      })
    )
    const body = await readApiResponse<{ authenticated: boolean; redirectTo: string }>(
      response
    )

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(login).toHaveBeenCalledWith({
      email: "admin.test@sadhanahostel.example",
      password: "password123",
    })
  })

  it("loads the current session through AuthService", async () => {
    const getSessionOverview = vi.fn().mockResolvedValue({
      authenticated: false,
      redirectTo: "/login",
    })

    vi.doMock("@/services/auth.service", () => ({
      AuthService: {
        create: vi.fn().mockResolvedValue({ getSessionOverview }),
      },
    }))

    const { GET } = await import("@/app/api/auth/session/route")
    const response = await GET()
    const body = await readApiResponse<{ authenticated: boolean; redirectTo: string }>(
      response
    )

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(getSessionOverview).toHaveBeenCalledOnce()
  })
})
