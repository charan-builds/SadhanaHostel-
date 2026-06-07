import "server-only"

import { logError, logger } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import { measureAsync } from "@/lib/performance"
import {
  resolveNotificationCatalog,
  type NotificationCategory,
  type NotificationPriority,
} from "@/lib/notifications/catalog"
import { sanitizeNotificationText } from "@/lib/security"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  NotificationsRepository,
  type NotificationChannel,
} from "@/repositories/notifications.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"
import {
  archiveNotificationSchema,
  markAllNotificationsReadSchema,
  markNotificationReadSchema,
  notificationListSchema,
} from "@/validations/notification.validation"

import { EmailProvider } from "./email.provider"
import { InAppProvider } from "./in-app.provider"
import { SmsProvider } from "./sms.provider"
import type {
  NotificationMessage,
  NotificationProvider,
  NotificationRecipient,
  NotificationSendInput,
} from "./types"
import { WhatsappProvider } from "./whatsapp.provider"
import { AuthService } from "../auth.service"
import { WebPushService } from "../pwa/web-push.service"
import { RealtimeService } from "../realtime"

export type QueueNotificationInput = {
  organizationId: string
  hostelId?: string | null
  channel?: NotificationChannel
  noticeId?: string | null
  recipient: NotificationRecipient
  message: NotificationMessage
  scheduledFor?: string | null
  actorUserId?: string | null
  category?: NotificationCategory
  priority?: NotificationPriority
}

export class NotificationService {
  private readonly authService: AuthService
  private readonly notificationsRepository: NotificationsRepository
  private readonly adminNotificationsRepository: NotificationsRepository
  private readonly providers: Record<NotificationChannel, NotificationProvider>
  private readonly realtimeService: RealtimeService
  private readonly webPushService: WebPushService

  constructor(
    private readonly db: AppSupabaseClient,
    adminDb: AppSupabaseClient = db
  ) {
    this.authService = new AuthService(db)
    this.notificationsRepository = new NotificationsRepository(db)
    this.adminNotificationsRepository = new NotificationsRepository(adminDb)
    this.realtimeService = new RealtimeService(db)
    this.webPushService = new WebPushService(adminDb)
    this.providers = {
      email: new EmailProvider(),
      sms: new SmsProvider(),
      whatsapp: new WhatsappProvider(),
      in_app: new InAppProvider(),
    }
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new NotificationService(db, createSupabaseAdminClient())
  }

  async queue(input: QueueNotificationInput) {
    const channel = input.channel ?? "in_app"
    const catalog = resolveNotificationCatalog({
      templateKey: input.message.templateKey,
      noticeId: input.noticeId,
      category: input.category ?? input.message.category,
      priority: input.priority ?? input.message.priority,
    })
    const notification = await this.notificationsRepository.create({
      organization_id: input.organizationId,
      hostel_id: input.hostelId,
      recipient_user_id: input.recipient.userId,
      resident_id: input.recipient.residentId,
      notice_id: input.noticeId,
      channel,
      title: sanitizeNotificationText(input.message.title),
      body: sanitizeNotificationText(input.message.body),
      template_key: input.message.templateKey,
      payload: input.message.payload ?? {},
      category: catalog.category,
      priority: catalog.priority,
      scheduled_for: input.scheduledFor,
      status: input.scheduledFor ? "queued" : "queued",
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })

    incrementMetric("notifications.queued", 1, {
      channel,
      organizationId: input.organizationId,
    })

    await this.realtimeService.notificationCreated({
      organizationId: notification.organization_id,
      hostelId: notification.hostel_id,
      notificationId: notification.id,
      recipientUserId: notification.recipient_user_id,
      residentId: notification.resident_id,
    })

    if (channel === "in_app" && shouldSendPushNow(input.scheduledFor)) {
      await this.webPushService.sendForNotification(notification)
    }

    return notification
  }

  async listForCurrentUser(input: unknown) {
    const values = notificationListSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const hostelId = values.hostelId
      ? this.authService.resolveHostelScope(context, values.organizationId, values.hostelId)
      : undefined

    return this.notificationsRepository.list({
      ...values,
      hostelId: hostelId ?? undefined,
      recipientUserId: context.authUser.id,
      channel: values.channel ?? "in_app",
      pageSize: values.pageSize ?? 20,
    })
  }

  async markRead(notificationId: string, input: unknown) {
    const values = markNotificationReadSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.adminNotificationsRepository.markRead({
      notificationId,
      organizationId: values.organizationId,
      recipientUserId: context.authUser.id,
      actorUserId: context.authUser.id,
    })
  }

  async markAllRead(input: unknown) {
    const values = markAllNotificationsReadSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const hostelId = values.hostelId
      ? this.authService.resolveHostelScope(context, values.organizationId, values.hostelId)
      : undefined

    return {
      updated: await this.adminNotificationsRepository.markAllRead({
        organizationId: values.organizationId,
        hostelId: hostelId ?? undefined,
        recipientUserId: context.authUser.id,
        actorUserId: context.authUser.id,
      }),
    }
  }

  async archive(notificationId: string, input: unknown) {
    const values = archiveNotificationSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.adminNotificationsRepository.archive({
      notificationId,
      organizationId: values.organizationId,
      recipientUserId: context.authUser.id,
      actorUserId: context.authUser.id,
    })
  }

  async send(input: NotificationSendInput) {
    return measureAsync(
      {
        name: "notification_send",
        kind: "external",
        slowMs: 1500,
        tags: {
          channel: input.notification.channel,
          organizationId: input.notification.organization_id,
        },
      },
      async () => {
        const provider = this.providers[input.notification.channel]

        try {
          const result = await provider.send(input)
          const now = new Date().toISOString()

          await this.notificationsRepository.createLog({
            organization_id: input.notification.organization_id,
            hostel_id: input.notification.hostel_id,
            notification_id: input.notification.id,
            channel: input.notification.channel,
            provider: result.provider,
            provider_message_id: result.providerMessageId,
            status: result.status,
            sent_at: result.status === "sent" ? now : null,
            error_message: result.errorMessage,
            request_payload: this.toSafePayload(input),
            response_payload: result.responsePayload,
          })

          await this.notificationsRepository.update(
            input.notification.id,
            input.notification.organization_id,
            {
              status: result.status,
              sent_at: result.status === "sent" ? now : input.notification.sent_at,
              failure_reason: result.errorMessage,
            }
          )

          incrementMetric(`notifications.${result.status}`, 1, {
            channel: input.notification.channel,
            organizationId: input.notification.organization_id,
          })

          return result
        } catch (error) {
          logError(error, {
            notificationId: input.notification.id,
            organizationId: input.notification.organization_id,
          })

          await this.notificationsRepository.update(
            input.notification.id,
            input.notification.organization_id,
            {
              status: "failed",
              failure_reason:
                error instanceof Error ? error.message : "Notification provider failed.",
            }
          )

          throw error
        }
      }
    )
  }

  async processDue(limit = 50) {
    const queued = await this.notificationsRepository.listDueQueued(limit)
    let processed = 0
    let failed = 0

    for (const notification of queued) {
      try {
        await this.send({
          notification,
          recipient: {
            userId: notification.recipient_user_id,
            residentId: notification.resident_id,
          },
        })
        processed += 1
      } catch {
        failed += 1
      }
    }

    logger.info({
      event: "notifications.processed",
      message: "Queued notifications processed.",
      metadata: {
        processed,
        failed,
      },
    })

    return { processed, failed }
  }

  private toSafePayload(input: NotificationSendInput): Json {
    return {
      notification_id: input.notification.id,
      channel: input.notification.channel,
      recipient_user_id: input.recipient.userId,
      resident_id: input.recipient.residentId,
      has_email: Boolean(input.recipient.email),
      has_phone: Boolean(input.recipient.phone),
    }
  }
}

function shouldSendPushNow(scheduledFor?: string | null) {
  if (!scheduledFor) {
    return true
  }

  return new Date(scheduledFor).getTime() <= Date.now()
}
