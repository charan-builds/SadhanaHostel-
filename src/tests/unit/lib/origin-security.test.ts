import { describe, expect, it } from "vitest"

import {
  ORIGIN_SECURITY_ERROR_CODE,
  assertSameOriginMutation,
  validateSameOriginMutation,
} from "@/lib/api/origin-security"
import { ApiError } from "@/lib/api/api-error"

describe("origin security guard", () => {
  it("allows safe methods without browser origin metadata", () => {
    const result = validateSameOriginMutation(new Request("http://localhost/api/residents"))

    expect(result).toEqual({ allowed: true, reason: "safe_method" })
  })

  it("allows same-origin mutation requests with Supabase cookies", () => {
    const result = validateSameOriginMutation(
      mutationRequest({
        cookie: "sb-test-auth-token=token",
        origin: "http://localhost",
        "sec-fetch-site": "same-origin",
      })
    )

    expect(result).toEqual({ allowed: true, reason: "same_origin_header" })
  })

  it("allows same-origin referers when Origin is absent", () => {
    const result = validateSameOriginMutation(
      mutationRequest({
        cookie: "sb-test-auth-token=token",
        referer: "http://localhost/admin/payments",
        "sec-fetch-site": "same-origin",
      })
    )

    expect(result).toEqual({ allowed: true, reason: "same_origin_referer" })
  })

  it("rejects cross-site fetch metadata before trusting other browser signals", () => {
    const result = validateSameOriginMutation(
      mutationRequest({
        cookie: "sb-test-auth-token=token",
        origin: "http://localhost",
        "sec-fetch-site": "cross-site",
      })
    )

    expect(result.allowed).toBe(false)
    expect(result).toMatchObject({
      reason: "cross_site_fetch_metadata",
      message: "Cross-site mutation blocked.",
    })
  })

  it("rejects untrusted Origin values", () => {
    const result = validateSameOriginMutation(
      mutationRequest({
        cookie: "sb-test-auth-token=token",
        origin: "https://attacker.example",
      })
    )

    expect(result.allowed).toBe(false)
    expect(result).toMatchObject({
      reason: "untrusted_origin",
    })
  })

  it("rejects cookie-authenticated mutations without Origin, Referer, or trusted fetch metadata", () => {
    const result = validateSameOriginMutation(
      mutationRequest({
        cookie: "sb-test-auth-token=token",
      })
    )

    expect(result.allowed).toBe(false)
    expect(result).toMatchObject({
      reason: "missing_browser_origin",
    })
  })

  it("allows non-cookie API clients without browser metadata", () => {
    const result = validateSameOriginMutation(
      mutationRequest({
        authorization: "Bearer service-token",
      })
    )

    expect(result).toEqual({ allowed: true, reason: "non_cookie_api_client" })
  })

  it("allows Vercel forwarded hosts as trusted deployment origins", () => {
    const result = validateSameOriginMutation(
      new Request("https://sadhana-hostel.vercel.app/api/payments/verify", {
        method: "POST",
        headers: {
          cookie: "sb-test-auth-token=token",
          origin: "https://hostel.example.com",
          "x-forwarded-host": "hostel.example.com",
          "x-forwarded-proto": "https",
        },
      })
    )

    expect(result).toEqual({ allowed: true, reason: "same_origin_header" })
  })

  it("throws a structured API error for blocked mutations", () => {
    expect(() =>
      assertSameOriginMutation(
        mutationRequest({
          cookie: "sb-test-auth-token=token",
          origin: "https://attacker.example",
        })
      )
    ).toThrow(ApiError)

    try {
      assertSameOriginMutation(
        mutationRequest({
          cookie: "sb-test-auth-token=token",
          origin: "https://attacker.example",
        })
      )
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe(ORIGIN_SECURITY_ERROR_CODE)
      expect((error as ApiError).statusCode).toBe(403)
    }
  })
})

function mutationRequest(headers: HeadersInit) {
  return new Request("http://localhost/api/payments/verify", {
    method: "POST",
    headers,
  })
}
