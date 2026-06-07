import { NoticesRepository } from "@/repositories/notices.repository"
import { NotificationsRepository } from "@/repositories/notifications.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import { NotificationService } from "@/services/notifications"
import { noticeTargetsResident } from "@/lib/notices/audience"
import { noticeNotificationClassification } from "@/lib/notices/notification-classification"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type ScheduledNoticesPayload = OrganizationJobPayload & {
  runAt: string
  limit?: number
}

export const scheduledNoticesJob: JobDefinition<ScheduledNoticesPayload> = {
  name: "scheduled_notices",
  queueName: "notifications",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    [
      "scheduled_notices",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.runAt.slice(0, 16),
    ].join(":"),
  async run(payload, context) {
    const noticesRepository = new NoticesRepository(context.db)
    const residentsRepository = new ResidentsRepository(context.db)
    const notificationsRepository = new NotificationsRepository(context.db)
    const notificationService = new NotificationService(context.db)
    const notices = await noticesRepository.listPublishedForFanout(
      payload.organizationId,
      payload.runAt,
      payload.limit ?? 100
    )
    const residents = await residentsRepository.listActiveForBilling(
      payload.organizationId,
      payload.hostelId
    )
    let processed = 0
    let skipped = 0

    for (const notice of notices) {
      for (const resident of residents) {
        if (!noticeTargetsResident(notice, resident)) {
          skipped += 1
          continue
        }

        const existing = await notificationsRepository.findByNoticeRecipient({
          organizationId: payload.organizationId,
          noticeId: notice.id,
          residentId: resident.id,
          recipientUserId: resident.user_id,
        })

        if (existing) {
          skipped += 1
          continue
        }

        const classification = noticeNotificationClassification(notice)
        await notificationService.queue({
          organizationId: payload.organizationId,
          hostelId: resident.hostel_id,
          channel: "in_app",
          noticeId: notice.id,
          recipient: {
            residentId: resident.id,
            userId: resident.user_id,
            email: resident.email,
            phone: resident.phone,
          },
          message: {
            title: notice.title,
            body: notice.body,
            templateKey: classification.templateKey,
            payload: {
              notice_id: notice.id,
              notice_type: notice.notice_type,
              audience_type: notice.audience_type,
              requires_acknowledgement: notice.requires_acknowledgement,
            },
            category: classification.category,
            priority: classification.priority,
          },
        })

        if (resident.phone) {
          await notificationService.queue({
            organizationId: payload.organizationId,
            hostelId: resident.hostel_id,
            channel: "whatsapp",
            noticeId: notice.id,
            recipient: {
              residentId: resident.id,
              userId: resident.user_id,
              email: resident.email,
              phone: resident.phone,
            },
            message: {
              title: notice.title,
              body: notice.body,
              templateKey: classification.templateKey,
              payload: {
                notice_id: notice.id,
                notice_type: notice.notice_type,
                audience_type: notice.audience_type,
                requires_acknowledgement: notice.requires_acknowledgement,
              },
              category: classification.category,
              priority: classification.priority,
            },
          })
        }
        processed += 1
      }
    }

    return {
      status: "completed",
      processed,
      skipped,
      failed: 0,
      message: "Scheduled notices fanned out to resident notifications.",
      metadata: {
        organizationId: payload.organizationId,
        hostelId: payload.hostelId,
        runAt: payload.runAt,
        noticeCount: notices.length,
        residentCount: residents.length,
      },
    }
  },
}
