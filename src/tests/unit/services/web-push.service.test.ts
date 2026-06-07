import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WebPushService } from "@/services/pwa/web-push.service"
import {
  RESIDENT_ID,
  RESIDENT_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import type { NotificationRow } from "@/repositories/notifications.repository"
import type { PushSubscriptionRow } from "@/repositories/push-subscriptions.repository"

const mocks = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
  listActiveForRecipient: vi.fn(),
  updateSubscription: vi.fn(),
  revokeEndpoint: vi.fn(),
  createLog: vi.fn(),
}))

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}))

vi.mock("@/repositories/push-subscriptions.repository", () => ({
  PushSubscriptionsRepository: vi.fn().mockImplementation(
    function PushSubscriptionsRepositoryMock() {
      return {
        listActiveForRecipient: mocks.listActiveForRecipient,
        update: mocks.updateSubscription,
        revokeEndpoint: mocks.revokeEndpoint,
      }
    }
  ),
}))

vi.mock("@/repositories/notifications.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/repositories/notifications.repository")>()

  return {
    ...actual,
    NotificationsRepository: vi.fn().mockImplementation(
      function NotificationsRepositoryMock() {
        return {
          createLog: mocks.createLog,
        }
      }
    ),
  }
})

describe("WebPushService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key")
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key")
    mocks.updateSubscription.mockResolvedValue({})
    mocks.revokeEndpoint.mockResolvedValue(1)
    mocks.createLog.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("skips delivery when VAPID keys are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "")
    vi.stubEnv("VAPID_PRIVATE_KEY", "")
    const service = new WebPushService({} as never)
    const result = await service.sendForNotification(notificationFixture())

    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 })
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it("retries transient provider failures and succeeds without incrementing subscription failures", async () => {
    mocks.listActiveForRecipient.mockResolvedValue([subscriptionFixture()])
    mocks.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error("provider unavailable"), { statusCode: 503 }))
      .mockResolvedValueOnce({
        statusCode: 201,
        headers: {
          "x-endpoint-message-id": "provider-message-1",
        },
      })

    const service = new WebPushService({} as never, { retryDelayMs: 0 })
    const result = await service.sendForNotification(notificationFixture())

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 })
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2)
    expect(mocks.updateSubscription).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000401",
      expect.objectContaining({
        failure_count: 0,
      })
    )
    expect(mocks.revokeEndpoint).not.toHaveBeenCalled()
    expect(mocks.createLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "failed",
        attempt_number: 1,
        response_payload: expect.objectContaining({
          retryable: true,
          final_attempt: false,
        }),
      })
    )
    expect(mocks.createLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: "sent",
        attempt_number: 2,
      })
    )
  })

  it("does not retry permanently gone endpoints and revokes them", async () => {
    mocks.listActiveForRecipient.mockResolvedValue([subscriptionFixture({ failure_count: 2 })])
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error("subscription gone"), { statusCode: 410 })
    )

    const service = new WebPushService({} as never, { retryDelayMs: 0 })
    const result = await service.sendForNotification(notificationFixture())

    expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 })
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
    expect(mocks.updateSubscription).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000401",
      expect.objectContaining({
        failure_count: 3,
      })
    )
    expect(mocks.revokeEndpoint).toHaveBeenCalledWith({
      endpoint: "https://push.example.test/subscription/000000000401",
    })
    expect(mocks.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        attempt_number: 1,
        response_payload: expect.objectContaining({
          status_code: 410,
          retryable: false,
          final_attempt: true,
        }),
      })
    )
  })
})

function notificationFixture(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    recipient_user_id: RESIDENT_USER_ID,
    resident_id: RESIDENT_ID,
    notice_id: null,
    channel: "in_app",
    status: "queued",
    title: "Fee due today",
    body: "Your hostel fee is due today.",
    template_key: "payment_due_today",
    payload: {},
    category: "finance",
    priority: "urgent",
    scheduled_for: null,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    archived_at: null,
    archived_by: null,
    failure_reason: null,
    is_active: true,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

function subscriptionFixture(
  overrides: Partial<PushSubscriptionRow> = {}
): PushSubscriptionRow {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    user_id: RESIDENT_USER_ID,
    resident_id: RESIDENT_ID,
    endpoint: "https://push.example.test/subscription/000000000401",
    p256dh_key: "p256dh-key",
    auth_key: "auth-key",
    device_label: "Chrome",
    platform: "web",
    user_agent: "Vitest",
    failure_count: 0,
    last_seen_at: "2026-06-06T00:00:00.000Z",
    last_sent_at: null,
    revoked_at: null,
    revoked_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    ...overrides,
  }
}
