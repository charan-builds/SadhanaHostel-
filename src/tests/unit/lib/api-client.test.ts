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

  it("converts malformed JSON into a recoverable frontend API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{not-json", {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": "req-bad-json",
          },
        })
      )
    )

    await expect(apiFetch("/api/test", { retry: 0 })).rejects.toMatchObject({
      name: "FrontendApiError",
      code: "MALFORMED_API_RESPONSE",
      requestId: "req-bad-json",
    } satisfies Partial<FrontendApiError>)
  })

  it("does not retry authentication failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
            requestId: "req-auth",
          },
        }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(apiFetch("/api/protected", { retry: 2 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    } satisfies Partial<FrontendApiError>)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("retries transient network failures without surfacing a false auth failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { recovered: true },
            message: "ok",
          }),
          {
            headers: {
              "content-type": "application/json",
              "x-request-id": "req-recovered",
            },
          }
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      apiFetch<{ recovered: boolean }>("/api/flaky-network", { retry: 1 })
    ).resolves.toEqual({ recovered: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry non-idempotent mutations even when retry is requested", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      apiFetch("/api/payments/create", {
        method: "POST",
        body: { amount: 1000 },
        retry: 2,
      })
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    } satisfies Partial<FrontendApiError>)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("retries idempotent mutations when an idempotency key is present", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { created: true },
            message: "ok",
          }),
          {
            headers: {
              "content-type": "application/json",
              "x-request-id": "req-idempotent",
            },
          }
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      apiFetch<{ created: boolean }>("/api/payments/create", {
        method: "POST",
        body: { amount: 1000, idempotencyKey: "idempotency-key-1" },
        retry: 1,
      })
    ).resolves.toEqual({ created: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
