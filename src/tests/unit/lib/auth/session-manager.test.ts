import { beforeEach, describe, expect, it, vi } from "vitest"

import { FrontendApiError } from "@/lib/api-client"
import {
  hasBrowserSupabaseSessionCookie,
  loadSessionOverview,
} from "@/lib/auth/session-manager"
import { authSdk } from "@/sdk"

vi.mock("@/sdk", () => ({
  authSdk: {
    session: vi.fn(),
  },
}))

describe("session manager", () => {
  beforeEach(() => {
    vi.mocked(authSdk.session).mockReset()
    vi.unstubAllGlobals()
  })

  it("treats a missing session endpoint response as anonymous instead of throwing", async () => {
    vi.mocked(authSdk.session).mockRejectedValue(
      new FrontendApiError({
        code: "HTTP_404",
        message: "Not Found",
        status: 404,
      })
    )

    const session = await loadSessionOverview()

    expect(session.authenticated).toBe(false)
    expect(session.redirectTo).toBe("/admin/login")
  })

  it("detects Supabase auth cookies before loading public sessions", () => {
    vi.stubGlobal("document", {
      cookie: "theme=light; sb-project-ref-auth-token.0=abc; locale=en",
    })

    expect(hasBrowserSupabaseSessionCookie()).toBe(true)
  })
})
