import { describe, expect, it, vi } from "vitest"

import { WebPushService } from "@/services/pwa/web-push.service"
import {
  RESIDENT_ID,
  RESIDENT_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import type { NotificationRow } from "@/repositories/notifications.repository"

describe("WebPushService", () => {
  it("skips delivery when VAPID keys are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "")
    vi.stubEnv("VAPID_PRIVATE_KEY", "")
    const service = new WebPushService({} as never)
    const result = await service.sendForNotification({
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
    } satisfies NotificationRow)

    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 })
  })
})
