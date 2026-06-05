import { afterEach, describe, expect, it, vi } from "vitest"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { createJsonRequest, readApiResponse } from "@/tests/helpers"

describe("production safety API guards", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/operations")
    vi.unstubAllEnvs()
  })

  it("rejects demo-data reset in production before the service is created", async () => {
    vi.stubEnv("LAUNCH_MODE", "production")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    const create = vi.fn()

    vi.doMock("@/services/operations", () => ({
      DemoDataResetService: { create },
    }))

    const { POST } = await import("@/app/api/operations/demo-data-reset/route")
    const response = await POST(
      createJsonRequest("/api/operations/demo-data-reset", {
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: true,
      })
    )
    const body = await readApiResponse(response)

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })

  it("rejects mutating consistency repair in production before the service is created", async () => {
    vi.stubEnv("LAUNCH_MODE", "production")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    const create = vi.fn()

    vi.doMock("@/services/operations", () => ({
      ConsistencyService: { create },
    }))

    const { POST } = await import("@/app/api/operations/consistency/repair/route")
    const response = await POST(
      createJsonRequest("/api/operations/consistency/repair", {
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "reconcile_dues",
        dryRun: false,
      })
    )
    const body = await readApiResponse(response)

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })
})
