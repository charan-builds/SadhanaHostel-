import { afterEach, describe, expect, it, vi } from "vitest"

import { apiFetch, FrontendApiError } from "@/lib/api-client"
import { buildApiUrl } from "@/lib/api-client/request-builder"

vi.mock("@/lib/api-client/auth-token", () => ({
  getCurrentAccessToken: vi.fn().mockResolvedValue("token-1"),
}))

describe("api client utilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("builds API URLs while omitting empty query values", () => {
    expect(
      buildApiUrl("/api/residents", {
        organizationId: "org-1",
        page: 2,
        search: "",
        statuses: ["active", "draft"],
      })
    ).toBe("/api/residents?organizationId=org-1&page=2&statuses=active&statuses=draft")
  })

  it("unwraps successful API responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "one" },
          message: "ok",
        }),
        {
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-1",
          },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(apiFetch<{ id: string }>("/api/test")).resolves.toEqual({ id: "one" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      })
    )
  })

  it("throws normalized frontend API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "No access.",
              requestId: "req-2",
            },
          }),
          {
            status: 403,
            headers: {
              "content-type": "application/json",
            },
          }
        )
      )
    )

    await expect(apiFetch("/api/test", { retry: 0 })).rejects.toMatchObject({
      name: "FrontendApiError",
      code: "FORBIDDEN",
      status: 403,
      requestId: "req-2",
    } satisfies Partial<FrontendApiError>)
  })
})
