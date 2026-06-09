import { describe, expect, it } from "vitest"

import { buildNotificationIntelligence } from "@/lib/notifications/intelligence"
import type { NotificationRow } from "@/repositories/notifications.repository"

describe("notification intelligence", () => {
  it("summarizes priority, read, reminder, and delivery health", () => {
    const result = buildNotificationIntelligence(
      [
        notification({
          id: "failed",
          priority: "urgent",
          status: "failed",
          read_at: null,
          created_at: "2026-06-06T00:00:00.000Z",
        }),
        notification({
          id: "critical",
          priority: "critical",
          category: "hostel",
          status: "sent",
          read_at: null,
          created_at: "2026-06-08T01:00:00.000Z",
        }),
        notification({
          id: "scheduled",
          priority: "warning",
          status: "queued",
          scheduled_for: "2026-06-08T08:00:00.000Z",
          read_at: "2026-06-08T02:00:00.000Z",
        }),
      ],
      new Date("2026-06-08T03:00:00.000Z")
    )

    expect(result.total).toBe(3)
    expect(result.unread).toBe(2)
    expect(result.read).toBe(1)
    expect(result.readPercentage).toBe(33)
    expect(result.failed).toBe(1)
    expect(result.queued).toBe(1)
    expect(result.scheduled).toBe(1)
    expect(result.criticalUnread).toBe(1)
    expect(result.urgentUnread).toBe(1)
    expect(result.staleUnread).toBe(1)
    expect(result.topPriority).toBe("critical")
    expect(result.nextAction?.id).toBe("failed-delivery")
    expect(result.reminderActions.map((action) => action.id)).toEqual([
      "failed-delivery",
      "critical-unread",
      "urgent-unread",
      "stale-unread",
      "scheduled-soon",
    ])
  })

  it("returns a healthy empty-state summary when no notifications exist", () => {
    const result = buildNotificationIntelligence([], new Date("2026-06-08T03:00:00.000Z"))

    expect(result.total).toBe(0)
    expect(result.readPercentage).toBe(0)
    expect(result.topPriority).toBe("none")
    expect(result.nextAction).toBeNull()
    expect(result.reminderActions).toEqual([])
  })
})

function notification(overrides: Partial<NotificationRow>): NotificationRow {
  return {
    archived_at: null,
    archived_by: null,
    body: "Notification body",
    category: "finance",
    channel: "in_app",
    created_at: "2026-06-08T00:00:00.000Z",
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    delivered_at: null,
    failure_reason: null,
    hostel_id: "00000000-0000-4000-8000-000000000002",
    id: "notification-id",
    is_active: true,
    notice_id: null,
    organization_id: "00000000-0000-4000-8000-000000000001",
    payload: {},
    priority: "info",
    read_at: null,
    recipient_user_id: "00000000-0000-4000-8000-000000000003",
    resident_id: null,
    scheduled_for: null,
    sent_at: null,
    status: "queued",
    template_key: null,
    title: "Notification title",
    updated_at: "2026-06-08T00:00:00.000Z",
    updated_by: null,
    ...overrides,
  }
}
