import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AutomationService,
  isFinanceSafeAutomationJobName,
} from "@/services/operations/automation.service"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

describe("AutomationService production safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("blocks destructive manual automation jobs in production before auth", async () => {
    vi.stubEnv("LAUNCH_MODE", "production")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    const service = new AutomationService({} as never)
    const authService = {
      requirePermission: vi.fn(),
      requireHostelAccess: vi.fn(),
    }

    Object.assign(service, { authService })

    await expect(
      service.run({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        name: "stale_upload_cleanup",
        dryRun: false,
        payload: {},
      })
    ).rejects.toThrow(/automation destructive job is blocked in production/i)

    expect(authService.requirePermission).not.toHaveBeenCalled()
  })

  it("blocks enabling destructive automation settings in production outside dry-run-only mode", async () => {
    vi.stubEnv("LAUNCH_MODE", "production")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    const service = new AutomationService({} as never)
    const authService = {
      requirePermission: vi.fn(),
      requireHostelAccess: vi.fn(),
    }

    Object.assign(service, { authService })

    await expect(
      service.updateSettings({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        name: "stale_upload_cleanup",
        enabled: true,
        cronSchedule: "0 2 * * *",
        dryRunOnly: false,
      })
    ).rejects.toThrow(/automation destructive job settings is blocked in production/i)

    expect(authService.requirePermission).not.toHaveBeenCalled()
  })

  it("allows finance users to run only finance-safe automation through finance.manage", async () => {
    const service = new AutomationService({} as never)
    const authService = {
      requirePermission: vi.fn().mockResolvedValue(adminAuthContext({ roles: ["finance"] })),
      requireHostelAccess: vi.fn(),
    }
    const repository = {
      getAutomationSetting: vi.fn().mockResolvedValue(null),
    }

    Object.assign(service, { authService, repository })

    await expect(
      service.runFinanceSafe({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        name: "monthly_fee_generation",
        dryRun: true,
        payload: {},
      })
    ).resolves.toMatchObject({
      jobName: "monthly_fee_generation",
      dryRun: true,
    })

    expect(authService.requirePermission).toHaveBeenCalledWith("finance.manage")
    expect(authService.requireHostelAccess).toHaveBeenCalledWith(
      expect.any(Object),
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
  })

  it("does not expose destructive or system automation as finance-safe jobs", () => {
    expect(isFinanceSafeAutomationJobName("monthly_fee_generation")).toBe(true)
    expect(isFinanceSafeAutomationJobName("payment_reminder")).toBe(true)
    expect(isFinanceSafeAutomationJobName("stale_upload_cleanup")).toBe(false)
    expect(isFinanceSafeAutomationJobName("consistency_scan")).toBe(false)
  })

  it("runs owner and admin automation through automation.manage", async () => {
    const service = new AutomationService({} as never)
    const context = adminAuthContext()
    const authService = {
      requirePermission: vi.fn().mockResolvedValue(context),
      requireHostelAccess: vi.fn(),
    }
    const repository = {
      getAutomationSetting: vi.fn().mockResolvedValue(null),
    }

    Object.assign(service, { authService, repository })

    await expect(
      service.run({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        name: "consistency_validation",
        dryRun: true,
        payload: {},
      })
    ).resolves.toMatchObject({
      jobName: "consistency_validation",
      dryRun: true,
    })

    expect(authService.requirePermission).toHaveBeenCalledWith("automation.manage")
    expect(authService.requireHostelAccess).toHaveBeenCalledWith(
      context,
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
  })

  it("keeps the automation dashboard diagnostic repository service-scoped", () => {
    const userDb = {} as never
    const serviceDb = {} as never
    const service = new AutomationService(userDb, serviceDb)
    const internals = service as unknown as {
      repository: { db: unknown }
      adminRepository: { db: unknown }
    }

    expect(internals.repository.db).toBe(userDb)
    expect(internals.adminRepository.db).toBe(serviceDb)
  })
})
