import { InvoicesRepository } from "@/repositories/invoices.repository"
import { PaymentsRepository } from "@/repositories/payments.repository"
import { NotificationsRepository } from "@/repositories/notifications.repository"
import {
  paymentDueTemplateForDays,
  priorityForOverdueDays,
} from "@/lib/notifications/catalog"
import { NotificationService } from "@/services/notifications"
import { isResidentOperationallyVerified } from "@/services/onboarding/resident-onboarding.policy"

import type { JobDefinition, OrganizationJobPayload } from "./types"

export type PaymentReminderPayload = OrganizationJobPayload & {
  dueBeforeDate: string
  runDate?: string
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
    const notificationsRepository = new NotificationsRepository(context.db)
    const notificationService = new NotificationService(context.db)
    const runDate = payload.runDate ?? new Date().toISOString().slice(0, 10)
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

      const daysUntilDue = daysBetweenDateOnly(runDate, feeRecord.due_date)
      const daysOverdue = Math.max(Math.abs(daysUntilDue), 0)
      const isOverdue = daysUntilDue < 0
      const isWeeklyCollectionReminder = isOverdue && isWeeklyCollectionDay(runDate)
      const templateKey = isWeeklyCollectionReminder
        ? "weekly_collection_reminder"
        : paymentDueTemplateForDays(daysUntilDue)

      if (!shouldSendReminder(daysUntilDue, isWeeklyCollectionReminder)) {
        skipped += 1
        continue
      }

      const existing = await notificationsRepository.findByTemplateRecipientPayload({
        organizationId: payload.organizationId,
        templateKey,
        residentId: resident.id,
        feeRecordId: feeRecord.id,
        reminderDate: runDate,
      })

      if (existing) {
        skipped += 1
        continue
      }

      const reminderMessage = {
        title: reminderTitle(templateKey, daysOverdue),
        body: reminderBody({
          periodMonth: feeRecord.period_month,
          dueDate: feeRecord.due_date,
          balanceAmount: feeRecord.balance_amount,
          daysUntilDue,
          daysOverdue,
          isWeeklyCollectionReminder,
        }),
        templateKey,
        priority: isOverdue ? priorityForOverdueDays(daysOverdue) : undefined,
        payload: {
          fee_record_id: feeRecord.id,
          period_month: feeRecord.period_month,
          due_date: feeRecord.due_date,
          balance_amount: feeRecord.balance_amount,
          days_until_due: daysUntilDue,
          days_overdue: isOverdue ? daysOverdue : 0,
          reminder_date: runDate,
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

function shouldSendReminder(daysUntilDue: number, isWeeklyCollectionReminder: boolean) {
  return isWeeklyCollectionReminder || daysUntilDue < 0 || [0, 1, 3, 7].includes(daysUntilDue)
}

function reminderTitle(templateKey: string, daysOverdue: number) {
  switch (templateKey) {
    case "payment_due_7_days":
      return "Hostel fee due in 7 days"
    case "payment_due_3_days":
      return "Hostel fee due in 3 days"
    case "payment_due_tomorrow":
      return "Hostel fee due tomorrow"
    case "payment_due_today":
      return "Hostel fee due today"
    case "weekly_collection_reminder":
      return "Weekly collection reminder"
    case "payment_overdue":
      return `Hostel fee overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
    default:
      return "Hostel fee payment reminder"
  }
}

function reminderBody(input: {
  periodMonth: string
  dueDate: string
  balanceAmount: number
  daysUntilDue: number
  daysOverdue: number
  isWeeklyCollectionReminder: boolean
}) {
  if (input.isWeeklyCollectionReminder) {
    return `Weekly reminder: your hostel fee for ${input.periodMonth} is overdue by ${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"} with a pending balance of INR ${input.balanceAmount}.`
  }

  if (input.daysUntilDue < 0) {
    return `Your hostel fee for ${input.periodMonth} is overdue by ${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"} with a pending balance of INR ${input.balanceAmount}.`
  }

  if (input.daysUntilDue === 0) {
    return `Your hostel fee for ${input.periodMonth} is due today with a pending balance of INR ${input.balanceAmount}.`
  }

  if (input.daysUntilDue === 1) {
    return `Your hostel fee for ${input.periodMonth} is due tomorrow with a pending balance of INR ${input.balanceAmount}.`
  }

  return `Your hostel fee for ${input.periodMonth} is due on ${input.dueDate} with a pending balance of INR ${input.balanceAmount}.`
}

function daysBetweenDateOnly(fromDate: string, toDate: string) {
  return (Date.parse(`${toDate}T00:00:00.000Z`) - Date.parse(`${fromDate}T00:00:00.000Z`)) / 86_400_000
}

function isWeeklyCollectionDay(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay() === 1
}
