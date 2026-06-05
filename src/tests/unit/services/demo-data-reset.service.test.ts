import { afterEach, describe, expect, it, vi } from "vitest"

import { DemoDataResetService } from "@/services/operations/demo-data-reset.service"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("DemoDataResetService", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("blocks demo reset in production before auth or database calls", async () => {
    vi.stubEnv("LAUNCH_MODE", "production")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    const authService = {
      requireRole: vi.fn(),
      requireHostelAccess: vi.fn(),
    }
    const adminDb = {
      rpc: vi.fn(),
    }
    const service = new DemoDataResetService(authService as never, adminDb as never)

    await expect(
      service.reset({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: true,
      })
    ).rejects.toThrow(/demo data reset is blocked in production/i)

    expect(authService.requireRole).not.toHaveBeenCalled()
    expect(adminDb.rpc).not.toHaveBeenCalled()
  })
})
