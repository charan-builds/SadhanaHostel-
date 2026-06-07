import { describe, expect, it, vi } from "vitest"

import { PushSubscriptionsService } from "@/services/pwa/push-subscriptions.service"
import {
  RESIDENT_ID,
  RESIDENT_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  residentFixture,
} from "@/tests/fixtures"
import { residentAuthContext } from "@/tests/helpers"

describe("PushSubscriptionsService", () => {
  it("stores subscriptions for the authenticated resident tenant context", async () => {
    const service = new PushSubscriptionsService({} as never, {} as never)
    const context = residentAuthContext()
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(context),
      requireOrganizationAccess: vi.fn(),
      resolveHostelScope: vi.fn(),
    }
    const residentsRepository = {
      getByUserId: vi.fn().mockResolvedValue(
        residentFixture({
          id: RESIDENT_ID,
          user_id: RESIDENT_USER_ID,
          organization_id: TEST_ORGANIZATION_ID,
          hostel_id: TEST_HOSTEL_ID,
        })
      ),
    }
    const pushSubscriptionsRepository = {
      upsert: vi.fn().mockImplementation((values) => ({
        id: "push-subscription-id",
        ...values,
      })),
    }

    Object.assign(service as object, {
      authService,
      residentsRepository,
      pushSubscriptionsRepository,
    })

    await service.subscribe({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: {
        endpoint: "https://push.example.test/send/abc",
        keys: {
          p256dh: "a".repeat(88),
          auth: "b".repeat(24),
        },
      },
      userAgent: "Vitest",
      platform: "test",
    })

    expect(authService.requireOrganizationAccess).toHaveBeenCalledWith(
      context,
      TEST_ORGANIZATION_ID
    )
    expect(pushSubscriptionsRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        user_id: context.authUser.id,
        resident_id: RESIDENT_ID,
        endpoint: "https://push.example.test/send/abc",
      })
    )
  })
})
