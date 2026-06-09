import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

import { forbidden } from "@/lib/api"
import { SupportService } from "@/services/support.service"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createOperationalAlertsHarness(role: "owner" | "admin" | "finance") {
  const service = new SupportService({} as never, {} as never)
  const context = adminAuthContext({
    roles: [role],
    primaryRole: role,
    organizationId: TEST_ORGANIZATION_ID,
    hostelIds: [TEST_HOSTEL_ID],
  })
  const authService = {
    requirePermission: vi.fn().mockImplementation((permission: string) => {
      if (role === "finance" && permission === "residents.manage") {
        return Promise.reject(forbidden("Your role does not allow this action."))
      }

      return Promise.resolve(context)
    }),
    requireHostelAccess: vi.fn(),
  }
  const requestScopedSupportRepository = {
    countPasswordResetRequests: vi.fn().mockRejectedValue(forbidden()),
    count: vi.fn().mockRejectedValue(forbidden()),
  }
  const adminSupportRepository = {
    countPasswordResetRequests: vi.fn().mockResolvedValue(role === "owner" ? 1 : 0),
    count: vi.fn().mockResolvedValue(0),
  }
  const requestScopedOperationsRepository = {
    count: vi.fn().mockRejectedValue(forbidden()),
    list: vi.fn().mockRejectedValue(forbidden()),
    listResidentTenantIdentityAnomalies: vi.fn().mockRejectedValue(forbidden()),
    recordConsistencyReport: vi.fn().mockRejectedValue(forbidden()),
  }
  const adminOperationsRepository = {
    count: vi.fn().mockResolvedValue(0),
    list: vi.fn().mockResolvedValue([]),
    listResidentTenantIdentityAnomalies: vi.fn().mockResolvedValue([]),
    recordConsistencyReport: vi.fn().mockResolvedValue({}),
  }

  Object.assign(service as object, {
    authService,
    supportRepository: requestScopedSupportRepository,
    adminSupportRepository,
    operationsRepository: requestScopedOperationsRepository,
    adminOperationsRepository,
    countOnboardingQueue: vi.fn().mockResolvedValue(0),
    countPayments: vi.fn().mockResolvedValue(0),
    loadVacancy: vi.fn().mockResolvedValue({ available_beds: 20 }),
    hasActivePaymentSettings: vi.fn().mockResolvedValue(true),
  })

  return {
    service,
    authService,
    requestScopedSupportRepository,
    adminSupportRepository,
    requestScopedOperationsRepository,
    adminOperationsRepository,
  }
}

describe("SupportService operational alerts permissions", () => {
  it("allows owners to read operational alerts through authorized aggregate repositories", async () => {
    const {
      service,
      authService,
      requestScopedSupportRepository,
      adminSupportRepository,
      requestScopedOperationsRepository,
      adminOperationsRepository,
    } = createOperationalAlertsHarness("owner")

    const alerts = await service.getOperationalAlerts({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(authService.requirePermission).toHaveBeenCalledWith("residents.manage")
    expect(authService.requireHostelAccess).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["owner"] }),
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "support.password_reset",
          count: 1,
        }),
      ])
    )
    expect(adminSupportRepository.countPasswordResetRequests).toHaveBeenCalled()
    expect(adminOperationsRepository.count).toHaveBeenCalled()
    expect(requestScopedSupportRepository.countPasswordResetRequests).not.toHaveBeenCalled()
    expect(requestScopedSupportRepository.count).not.toHaveBeenCalled()
    expect(requestScopedOperationsRepository.count).not.toHaveBeenCalled()
    expect(requestScopedOperationsRepository.list).not.toHaveBeenCalled()
    expect(requestScopedOperationsRepository.listResidentTenantIdentityAnomalies).not.toHaveBeenCalled()
    expect(requestScopedOperationsRepository.recordConsistencyReport).not.toHaveBeenCalled()
  })

  it("allows admins to read operational alerts", async () => {
    const { service, authService } = createOperationalAlertsHarness("admin")

    await expect(
      service.getOperationalAlerts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).resolves.toEqual(expect.any(Array))

    expect(authService.requireHostelAccess).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["admin"] }),
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
  })

  it("denies finance-only users before loading operational support alert data", async () => {
    const {
      service,
      authService,
      adminSupportRepository,
      adminOperationsRepository,
    } = createOperationalAlertsHarness("finance")

    await expect(
      service.getOperationalAlerts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).rejects.toThrow("Your role does not allow this action.")

    expect(authService.requirePermission).toHaveBeenCalledWith("residents.manage")
    expect(authService.requireHostelAccess).not.toHaveBeenCalled()
    expect(adminSupportRepository.countPasswordResetRequests).not.toHaveBeenCalled()
    expect(adminOperationsRepository.count).not.toHaveBeenCalled()
  })

  it("denies users without resident-management permission before loading alert data", async () => {
    const service = new SupportService({} as never, {} as never)
    const authService = {
      requirePermission: vi
        .fn()
        .mockRejectedValue(forbidden("Your role does not allow this action.")),
      requireHostelAccess: vi.fn(),
    }
    const adminSupportRepository = {
      countPasswordResetRequests: vi.fn(),
      count: vi.fn(),
    }
    const adminOperationsRepository = {
      count: vi.fn(),
      list: vi.fn(),
    }

    Object.assign(service as object, {
      authService,
      adminSupportRepository,
      adminOperationsRepository,
    })

    await expect(
      service.getOperationalAlerts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).rejects.toThrow("Your role does not allow this action.")

    expect(authService.requirePermission).toHaveBeenCalledWith("residents.manage")
    expect(authService.requireHostelAccess).not.toHaveBeenCalled()
    expect(adminSupportRepository.countPasswordResetRequests).not.toHaveBeenCalled()
    expect(adminOperationsRepository.count).not.toHaveBeenCalled()
  })

  it("requires resident-management permission for admin-side support updates", () => {
    const source = readFileSync(join(process.cwd(), "src/services/support.service.ts"), "utf8")
    const updateStart = source.indexOf("async updateRequest")
    const permissionGuard = source.indexOf('requirePermission("residents.manage")', updateStart)
    const repositoryRead = source.indexOf("this.supportRepository.getById", updateStart)

    expect(updateStart).toBeGreaterThan(-1)
    expect(permissionGuard).toBeGreaterThan(updateStart)
    expect(repositoryRead).toBeGreaterThan(permissionGuard)
  })
})

describe("SupportService resident password reset approval edge cases", () => {
  it("guards already-approved password reset requests before generating another temporary password", () => {
    const source = readFileSync(join(process.cwd(), "src/services/support.service.ts"), "utf8")
    const alreadyGeneratedGuard = source.indexOf(
      'previous.status === "waiting_on_resident"'
    )
    const completedGuard = source.indexOf(
      'previous.status === "resolved" || previous.status === "closed"'
    )
    const resetSideEffect = source.indexOf("resetResidentTemporaryPassword")

    expect(alreadyGeneratedGuard).toBeGreaterThan(-1)
    expect(completedGuard).toBeGreaterThan(-1)
    expect(resetSideEffect).toBeGreaterThan(-1)
    expect(alreadyGeneratedGuard).toBeLessThan(resetSideEffect)
    expect(completedGuard).toBeLessThan(resetSideEffect)
  })
})
