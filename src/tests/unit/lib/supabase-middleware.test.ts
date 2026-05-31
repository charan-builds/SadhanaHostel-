import { createServerClient } from "@supabase/ssr"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateSession } from "@/lib/supabase/middleware"

vi.mock("@/lib/env", () => ({
  getSupabasePublicConfig: () => ({
    url: "https://test-project.supabase.co",
    anonKey: "test-anon-key",
  }),
  hasSupabaseConfig: () => true,
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}))

const createServerClientMock = vi.mocked(createServerClient)

describe("updateSession", () => {
  beforeEach(() => {
    createServerClientMock.mockReset()
  })

  it("clears stale Supabase auth cookies when the refresh token no longer exists", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: {
            code: "refresh_token_not_found",
            message: "Invalid Refresh Token: Refresh Token Not Found",
          },
        }),
      },
    } as never)

    const request = new NextRequest("http://localhost/admin/dashboard", {
      headers: {
        cookie: [
          "sb-test-project-auth-token=stale",
          "sb-test-project-auth-token.0=stale-chunk",
          "theme=dark",
        ].join("; "),
      },
    })

    const { response, user } = await updateSession(request)

    expect(user).toBeNull()
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("sb-test-project-auth-token=;"),
        expect.stringContaining("sb-test-project-auth-token.0=;"),
      ])
    )
    expect(response.headers.getSetCookie().join("\n")).not.toContain("theme=;")
  })
})
