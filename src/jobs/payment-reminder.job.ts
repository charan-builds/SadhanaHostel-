import { InvoicesRepository } from "@/repositories/invoices.repository"
import { PaymentsRepository } from "@/repositories/payments.repository"
import { NotificationService } from "@/services/notifications"
import { isResidentOperationallyVerified } from "@/services/onboarding/resident-onboarding.policy"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type PaymentReminderPayload = OrganizationJobPayload & {
  dueBeforeDate: string
  limit?: number
}

export const paymentReminderJob: JobDefinition<PaymentReminderPayload> = {
  name: "payment_reminder",
  queueName: "notifications",
  maxAttempts: 3,
  buildIdempotencyKey: (payload) =>
    [
      "payment_reminder",
      payload.organizationId,
      payload.hostelId ?? "all-hostels",
      payload.dueBeforeDate,
    ].join(":"),
  async run(payload, context) {
    const paymentsRepository = new PaymentsRepository(context.db)
    const invoicesRepository = new InvoicesRepository(context.db)
    const notificationService = new NotificationService(context.db)
    const dueRecords = await paymentsRepository.listDueFeeRecords(
      payload.organizationId,
      payload.dueBeforeDate,
      payload.limit ?? 100
    )
    let processed = 0
    let skipped = 0

    for (const feeRecord of dueRecords) {
      if (payload.hostelId && feeRecord.hostel_id !== payload.hostelId) {
        skipped += 1
        continue
      }

      const resident = await invoicesRepository.getResident(
        feeRecord.resident_id,
        payload.organizationId
      )

      if (!resident || !isResidentOperationallyVerified(resident)) {
        skipped += 1
        continue
      }

      const reminderMessage = {
        title: "Hostel fee payment reminder",
        body: `Your hostel fee for ${feeRecord.period_month} is due on ${feeRecord.due_date} with a pending balance of INR ${feeRecord.balance_amount}.`,
        templateKey: "payment_reminder",
        payload: {
          fee_record_id: feeRecord.id,
          period_month: feeRecord.period_month,
          due_date: feeRecord.due_date,
          balance_amount: feeRecord.balance_amount,
        },
      }

      await notificationService.queue({
        organizationId: payload.organizationId,
        hostelId: feeRecord.hostel_id,
        channel: "in_app",
        recipient: {
          residentId: resident.id,
          userId: resident.user_id,
          email: resident.email,
          phone: resident.phone,
        },
        message: reminderMessage,
      })

      if (resident.phone) {
        await notificationService.queue({
          organizationId: payload.organizationId,
          hostelId: feeRecord.hostel_id,
          channel: "whatsapp",
          recipient: {
            residentId: resident.id,
            userId: resident.user_id,
            email: resident.email,
            phone: resident.phone,
          },
          message: reminderMessage,
        })
      }
      processed += 1
    }

    return {
      status: "completed",
      processed,
      skipped,
      failed: 0,
      message: "Payment reminders queued.",
    }
  },
}
