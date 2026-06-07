import "server-only"

import webpush, { type PushSubscription } from "web-push"

import { getSiteUrl } from "@/lib/seo"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  PushSubscriptionsRepository,
  type PushSubscriptionRow,
} from "@/repositories/push-subscriptions.repository"
import { NotificationsRepository, type NotificationRow } from "@/repositories/notifications.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"

type WebPushResult = {
  sent: number
  failed: number
  skipped: number
}

export class WebPushService {
  private readonly pushSubscriptionsRepository: PushSubscriptionsRepository
  private readonly notificationsRepository: NotificationsRepository

  constructor(private readonly db: AppSupabaseClient = createSupabaseAdminClient()) {
    this.pushSubscriptionsRepository = new PushSubscriptionsRepository(db)
    this.notificationsRepository = new NotificationsRepository(db)
  }

  async sendForNotification(notification: NotificationRow): Promise<WebPushResult> {
    const config = getWebPushConfig()

    if (!config || !notification.recipient_user_id) {
      return { sent: 0, failed: 0, skipped: 1 }
    }

    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)

    const subscriptions =
      await this.pushSubscriptionsRepository.listActiveForRecipient({
        organizationId: notification.organization_id,
        userId: notification.recipient_user_id,
        residentId: notification.resident_id,
      })

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, skipped: 1 }
    }

    let sent = 0
    let failed = 0

    for (const subscription of subscriptions) {
      try {
        const response = await webpush.sendNotification(
          toWebPushSubscription(subscription),
          JSON.stringify(buildPushPayload(notification))
        )
        sent += 1
        await this.pushSubscriptionsRepository.update(subscription.id, {
          last_sent_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          failure_count: 0,
        })
        await this.notificationsRepository.createLog({
          organization_id: notification.organization_id,
          hostel_id: notification.hostel_id,
          notification_id: notification.id,
          channel: "in_app",
          provider: "web-push",
          provider_message_id: response.headers["x-endpoint-message-id"] ?? null,
          status: "sent",
          sent_at: new Date().toISOString(),
          request_payload: {
            endpoint: maskEndpoint(subscription.endpoint),
            subscription_id: subscription.id,
          },
          response_payload: {
            status_code: response.statusCode,
          },
        })
      } catch (error) {
        failed += 1
        const statusCode = webPushStatusCode(error)

        await this.pushSubscriptionsRepository.update(subscription.id, {
          failure_count: subscription.failure_count + 1,
        })

        if (statusCode === 404 || statusCode === 410) {
          await this.pushSubscriptionsRepository.revokeEndpoint({
            endpoint: subscription.endpoint,
          })
        }

        await this.notificationsRepository.createLog({
          organization_id: notification.organization_id,
          hostel_id: notification.hostel_id,
          notification_id: notification.id,
          channel: "in_app",
          provider: "web-push",
          status: "failed",
          request_payload: {
            endpoint: maskEndpoint(subscription.endpoint),
            subscription_id: subscription.id,
          },
          response_payload: {
            status_code: statusCode,
          },
          error_message:
            error instanceof Error ? error.message : "Web Push delivery failed.",
        })
      }
    }

    return { sent, failed, skipped: 0 }
  }
}

function getWebPushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.VAPID_CONTACT_EMAIL?.trim() ||
    getSiteUrl()

  if (!publicKey || !privateKey) {
    return null
  }

  return {
    publicKey,
    privateKey,
    subject: subject.startsWith("mailto:") || subject.startsWith("https:")
      ? subject
      : `mailto:${subject}`,
  }
}

function toWebPushSubscription(subscription: PushSubscriptionRow): PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh_key,
      auth: subscription.auth_key,
    },
  }
}

function buildPushPayload(notification: NotificationRow) {
  const payload = recordFromJson(notification.payload)
  const navigation = notificationNavigation(notification, payload)

  return {
    title: notification.title,
    body: notification.body,
    icon: "/pwa-icon/192",
    badge: "/pwa-icon/96",
    tag: notification.id,
    priority: notification.priority,
    actions: navigation.actions,
    data: {
      notificationId: notification.id,
      url: navigation.url,
      actions: navigation.actionUrls,
    },
  }
}

function notificationNavigation(
  notification: NotificationRow,
  payload: Record<string, unknown>
) {
  if (notification.notice_id || typeof payload.notice_id === "string") {
    const noticeId = notification.notice_id ?? payload.notice_id

    return {
      url: `/resident/notices?noticeId=${noticeId}`,
      actions: [{ action: "open_notice", title: "Open Notice" }],
      actionUrls: {
        open_notice: `/resident/notices?noticeId=${noticeId}`,
      },
    }
  }

  if (
    notification.template_key?.startsWith("payment_due") ||
    notification.template_key === "payment_overdue" ||
    notification.template_key === "payment_reminder"
  ) {
    return {
      url: "/resident/payments",
      actions: [{ action: "pay_now", title: "Pay Now" }],
      actionUrls: {
        pay_now: "/resident/payments",
      },
    }
  }

  if (typeof payload.invoice_id === "string") {
    return {
      url: `/resident/payments?invoiceId=${payload.invoice_id}`,
      actions: [
        { action: "view_invoice", title: "View Invoice" },
        { action: "pay_now", title: "Pay Now" },
      ],
      actionUrls: {
        view_invoice: `/resident/payments?invoiceId=${payload.invoice_id}`,
        pay_now: "/resident/payments",
      },
    }
  }

  if (notification.template_key?.startsWith("leave_")) {
    return {
      url: "/resident/leave",
      actions: [],
      actionUrls: {},
    }
  }

  return {
    url: "/resident/dashboard",
    actions: [],
    actionUrls: {},
  }
}

function recordFromJson(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function webPushStatusCode(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode)

    return Number.isFinite(statusCode) ? statusCode : null
  }

  return null
}

function maskEndpoint(endpoint: string) {
  if (endpoint.length <= 24) {
    return "masked"
  }

  return `${endpoint.slice(0, 16)}...${endpoint.slice(-8)}`
}
