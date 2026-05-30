import { beforeEach, describe, expect, it, vi } from "vitest"

import { logger } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import {
  RealtimeEventPublisher,
  buildResidentChannelName,
  buildTenantChannelName,
} from "@/services/realtime/event-publisher"

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/lib/metrics", () => ({
  incrementMetric: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}))

describe("RealtimeEventPublisher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("builds tenant-scoped global and hostel channel names", () => {
    expect(buildTenantChannelName("org-1")).toBe("tenant:org-1:global")
    expect(buildTenantChannelName("org-1", "hostel-1")).toBe(
      "tenant:org-1:hostel:hostel-1"
    )
    expect(buildResidentChannelName("org-1", "hostel-1", "resident-1")).toBe(
      "tenant:org-1:hostel:hostel-1:resident:resident-1"
    )
  })

  it("publishes private broadcast events on the tenant hostel channel", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const channel = vi.fn().mockReturnValue({ send })
    const publisher = new RealtimeEventPublisher({ channel } as never)

    const event = await publisher.publish({
      type: "payment.status_changed",
      organizationId: "org-1",
      hostelId: "hostel-1",
      actorUserId: "user-1",
      payload: {
        paymentId: "payment-1",
        status: "verified",
      },
    })

    expect(channel).toHaveBeenCalledWith("tenant:org-1:hostel:hostel-1", {
      config: {
        private: true,
        broadcast: {
          ack: false,
          self: false,
        },
      },
    })
    expect(send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "payment.status_changed",
      payload: expect.objectContaining({
        type: "payment.status_changed",
        organizationId: "org-1",
        hostelId: "hostel-1",
        actorUserId: "user-1",
        payload: {
          paymentId: "payment-1",
          status: "verified",
        },
      }),
    })
    expect(event).toEqual(
      expect.objectContaining({
        type: "payment.status_changed",
        organizationId: "org-1",
        hostelId: "hostel-1",
      })
    )
    expect(incrementMetric).toHaveBeenCalledWith("realtime.published", 1, {
      event: "payment.status_changed",
      organizationId: "org-1",
    })
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "realtime.published",
        organizationId: "org-1",
        userId: "user-1",
      })
    )
  })

  it("keeps the primary workflow recoverable when realtime publishing fails", async () => {
    const send = vi.fn().mockRejectedValue(new Error("socket unavailable"))
    const channel = vi.fn().mockReturnValue({ send })
    const publisher = new RealtimeEventPublisher({ channel } as never)

    await expect(
      publisher.publish({
        type: "resident.updated",
        organizationId: "org-1",
        actorUserId: "user-1",
        payload: {
          residentId: "resident-1",
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        type: "resident.updated",
        organizationId: "org-1",
        hostelId: undefined,
      })
    )
    expect(incrementMetric).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "realtime.publish_failed",
        organizationId: "org-1",
        metadata: expect.objectContaining({
          channelName: "tenant:org-1:global",
          eventType: "resident.updated",
        }),
      })
    )
  })

  it("publishes resident-scoped broadcasts without using the hostel topic", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const channel = vi.fn().mockReturnValue({ send })
    const publisher = new RealtimeEventPublisher({ channel } as never)

    await publisher.publish({
      type: "notification.created",
      organizationId: "org-1",
      hostelId: "hostel-1",
      residentId: "resident-1",
      payload: {
        notificationId: "notification-1",
      },
    })

    expect(channel).toHaveBeenCalledWith(
      "tenant:org-1:hostel:hostel-1:resident:resident-1",
      expect.objectContaining({
        config: expect.objectContaining({ private: true }),
      })
    )
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "notification.created",
        payload: expect.objectContaining({
          residentId: "resident-1",
        }),
      })
    )
  })
})
