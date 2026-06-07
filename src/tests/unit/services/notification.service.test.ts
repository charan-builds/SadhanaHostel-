import { describe, expect, it, vi } from "vitest"

import { NotificationService } from "@/services/notifications"
import {
  RESIDENT_ID,
  RESIDENT_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { residentAuthContext } from "@/tests/helpers"

describe("NotificationService smart center", () => {
  it("stamps category and priority from notification templates", async () => {
    const service = new NotificationService({} as never, {} as never)
    const notificationsRepository = {
      create: vi.fn().mockImplementation((values) => ({
        id: "notification-id",
        ...values,
      })),
    }
    const realtimeService = {
      notificationCreated: vi.fn().mockResolvedValue(undefined),
    }

    Object.assign(service as object, {
      notificationsRepository,
      realtimeService,
    })

    await service.queue({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      channel: "in_app",
      recipient: {
        userId: RESIDENT_USER_ID,
        residentId: RESIDENT_ID,
      },
      message: {
        title: "Hostel fee due today",
        body: "Your hostel fee is due today.",
        templateKey: "payment_due_today",
      },
    })

    expect(notificationsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "finance",
        priority: "urgent",
        template_key: "payment_due_today",
      })
    )
    expect(realtimeService.notificationCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        residentId: RESIDENT_ID,
      })
    )
  })

  it("archives only the current user's notification after organization access passes", async () => {
    const service = new NotificationService({} as never, {} as never)
    const context = residentAuthContext()
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(context),
      requireOrganizationAccess: vi.fn(),
    }
    const adminNotificationsRepository = {
      archive: vi.fn().mockResolvedValue({
        id: "notification-id",
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
      }),
    }

    Object.assign(service as object, {
      authService,
      adminNotificationsRepository,
    })

    await expect(
      service.archive("notification-id", { organizationId: TEST_ORGANIZATION_ID })
    ).resolves.toEqual(expect.objectContaining({ id: "notification-id" }))

    expect(authService.requireOrganizationAccess).toHaveBeenCalledWith(
      context,
      TEST_ORGANIZATION_ID
    )
    expect(adminNotificationsRepository.archive).toHaveBeenCalledWith({
      notificationId: "notification-id",
      organizationId: TEST_ORGANIZATION_ID,
      recipientUserId: context.authUser.id,
      actorUserId: context.authUser.id,
    })
  })
})
