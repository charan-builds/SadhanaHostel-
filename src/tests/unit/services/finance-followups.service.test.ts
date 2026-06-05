import { describe, expect, it, vi } from "vitest"

import { FinanceFollowupsService } from "@/services/finance-followups.service"
import {
  RESIDENT_ID,
  residentFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

describe("FinanceFollowupsService", () => {
  it("creates collection follow-ups through finance.manage and resident hostel access", async () => {
    const context = adminAuthContext({ roles: ["finance"], primaryRole: "finance" })
    const service = new FinanceFollowupsService({} as never)
    const resident = residentFixture({ id: RESIDENT_ID, hostel_id: TEST_HOSTEL_ID })
    const created = {
      id: "00000000-0000-4000-8000-000000000501",
      organization_id: TEST_ORGANIZATION_ID,
      hostel_id: TEST_HOSTEL_ID,
      resident_id: RESIDENT_ID,
      note: "Called resident, payment tomorrow.",
      priority: "high",
      assigned_to: context.authUser.id,
      status: "open",
    }
    const authService = {
      requirePermission: vi.fn().mockResolvedValue(context),
      requireHostelAccess: vi.fn(),
      requireOrganizationAccess: vi.fn(),
      resolveHostelScope: vi.fn((_context, _organizationId, hostelId) => hostelId ?? null),
    }
    const residentsRepository = {
      getById: vi.fn().mockResolvedValue(resident),
    }
    const followupsRepository = {
      create: vi.fn().mockResolvedValue(created),
      list: vi.fn(),
      complete: vi.fn(),
    }

    Object.assign(service, {
      authService,
      residentsRepository,
      followupsRepository,
    })

    await expect(
      service.create({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        notes: "Called resident, payment tomorrow.",
        priority: "high",
        assignedTo: context.authUser.id,
        nextFollowupAt: "2026-06-06T10:00:00.000Z",
      })
    ).resolves.toBe(created)

    expect(authService.requirePermission).toHaveBeenCalledWith("finance.manage")
    expect(authService.requireHostelAccess).toHaveBeenCalledWith(
      context,
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
    expect(followupsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: RESIDENT_ID,
        created_by: context.authUser.id,
        note: "Called resident, payment tomorrow.",
        priority: "high",
        assigned_to: context.authUser.id,
        next_followup_at: "2026-06-06T10:00:00.000Z",
        status: "open",
        metadata: {
          source: "finance_collection_center",
        },
      })
    )
  })

  it("prevents finance users from assigning follow-ups to another user", async () => {
    const context = adminAuthContext({ roles: ["finance"], primaryRole: "finance" })
    const service = new FinanceFollowupsService({} as never)
    const resident = residentFixture({ id: RESIDENT_ID, hostel_id: TEST_HOSTEL_ID })
    const authService = {
      requirePermission: vi.fn().mockResolvedValue(context),
      requireHostelAccess: vi.fn(),
      requireOrganizationAccess: vi.fn(),
      resolveHostelScope: vi.fn((_context, _organizationId, hostelId) => hostelId ?? null),
    }
    const residentsRepository = {
      getById: vi.fn().mockResolvedValue(resident),
    }
    const followupsRepository = {
      create: vi.fn(),
      list: vi.fn(),
      complete: vi.fn(),
    }

    Object.assign(service, {
      authService,
      residentsRepository,
      followupsRepository,
    })

    await expect(
      service.create({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        notes: "Assigning to someone else should be blocked.",
        assignedTo: "00000000-0000-4000-8000-000000000999",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
      message: "Finance follow-ups can only be assigned to the current user.",
    })

    expect(followupsRepository.create).not.toHaveBeenCalled()
  })

  it("completes follow-ups through finance.manage without requiring settings.manage", async () => {
    const service = new FinanceFollowupsService({} as never)
    const authService = {
      requirePermission: vi.fn().mockResolvedValue(adminAuthContext({ roles: ["finance"] })),
      requireOrganizationAccess: vi.fn(),
    }
    const followupsRepository = {
      complete: vi.fn().mockResolvedValue({ id: "followup-1", status: "completed" }),
    }

    Object.assign(service, {
      authService,
      followupsRepository,
    })

    await service.complete({
      organizationId: TEST_ORGANIZATION_ID,
      followupId: "00000000-0000-4000-8000-000000000501",
      notes: "Done",
    })

    expect(authService.requirePermission).toHaveBeenCalledWith("finance.manage")
    expect(authService.requirePermission).not.toHaveBeenCalledWith("settings.manage")
    expect(authService.requireOrganizationAccess).toHaveBeenCalledWith(
      expect.any(Object),
      TEST_ORGANIZATION_ID
    )
    expect(followupsRepository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        note: "Done",
      })
    )
  })
})
