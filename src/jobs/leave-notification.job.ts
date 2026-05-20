import { LeavesRepository } from "@/repositories/leaves.repository"
import { InvoicesRepository } from "@/repositories/invoices.repository"
import { NotificationService } from "@/services/notifications"
import type { Json } from "@/types/database"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type LeaveNotificationPayload = OrganizationJobPayload & {
  limit?: number
}

export const leaveNotificationJob: JobDefinition<LeaveNotificationPayload> = {
  name: "leave_notification",
  queueName: "notifications",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    ["leave_notification", payload.organizationId, payload.hostelId ?? "all-hostels"].join(":"),
  async run(payload, context) {
    const leavesRepository = new LeavesRepository(context.db)
    const invoicesRepository = new InvoicesRepository(context.db)
    const notificationService = new NotificationService(context.db)
    const leaves = await leavesRepository.listPendingParentNotifications(
      payload.organizationId,
      payload.limit ?? 100
    )
    let processed = 0
    let skipped = 0

    for (const leave of leaves) {
      if (payload.hostelId && leave.hostel_id !== payload.hostelId) {
        skipped += 1
        continue
      }

      const resident = await invoicesRepository.getResident(
        leave.resident_id,
        payload.organizationId
      )

      if (!resident) {
        skipped += 1
        continue
      }

      await notificationService.queue({
        organizationId: payload.organizationId,
        hostelId: leave.hostel_id,
        channel: resident.parent_email ? "email" : "in_app",
        recipient: {
          residentId: resident.id,
          userId: resident.parent_user_id,
          email: resident.parent_email,
          phone: resident.parent_phone,
        },
        message: {
          title: `Leave request ${leave.status}`,
          body: `${resident.full_name}'s leave request from ${leave.from_date} to ${leave.to_date} was ${leave.status}.`,
          templateKey: "leave_status_parent_notification",
          payload: {
            leave_request_id: leave.id,
            status: leave.status,
          },
        },
      })

      await leavesRepository.update(leave.id, payload.organizationId, {
        metadata: clearParentNotificationFlag(leave.metadata),
      })

      processed += 1
    }

    return {
      status: "completed",
      processed,
      skipped,
      failed: 0,
      message: "Leave notifications queued.",
    }
  },
}

function clearParentNotificationFlag(metadata: Json): Json {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      parent_notification_pending: false,
    }
  }

  return {
    ...metadata,
    parent_notification_pending: false,
  }
}
