import { describe, expect, it } from "vitest"

import { ApiError, errorResponse, successResponse } from "@/lib/api"

describe("API response helpers", () => {
  it("returns the standard success envelope", async () => {
    const response = successResponse({ id: "1" }, "Loaded.")
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      data: { id: "1" },
      message: "Loaded.",
    })
  })

  it("returns the standard error envelope", async () => {
    const response = errorResponse(new ApiError("FORBIDDEN", "No access.", 403))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "No access.",
      },
    })
  })
})
