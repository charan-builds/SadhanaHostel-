import { beforeEach, describe, expect, it } from "vitest"

import {
  assertRateLimit,
  resetRateLimitBuckets,
  type RateLimitPolicy,
} from "@/lib/rate-limit"

const policy: RateLimitPolicy = {
  name: "test.policy",
  limit: 2,
  windowMs: 60_000,
}

function request(ip: string) {
  return new Request("http://localhost/api/test", {
    headers: {
      "x-forwarded-for": ip,
    },
  })
}

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimitBuckets()
  })

  it("allows requests until the configured limit is exceeded", () => {
    expect(() => assertRateLimit(request("10.0.0.1"), policy)).not.toThrow()
    expect(() => assertRateLimit(request("10.0.0.1"), policy)).not.toThrow()

    expect(() => assertRateLimit(request("10.0.0.1"), policy)).toThrow(
      "Too many requests. Please try again later."
    )
  })

  it("separates buckets by tenant scope", () => {
    expect(() =>
      assertRateLimit(request("10.0.0.1"), policy, {
        organizationId: "org-a",
      })
    ).not.toThrow()
    expect(() =>
      assertRateLimit(request("10.0.0.1"), policy, {
        organizationId: "org-b",
      })
    ).not.toThrow()
  })
})
