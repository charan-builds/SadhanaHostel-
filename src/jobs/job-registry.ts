import { invoiceCleanupJob } from "./invoice-cleanup.job"
import { leaveNotificationJob } from "./leave-notification.job"
import { monthlyFeeGenerationJob } from "./monthly-fee-generation.job"
import { paymentReminderJob } from "./payment-reminder.job"
import { staleUploadCleanupJob } from "./stale-upload-cleanup.job"

export const jobRegistry = {
  [monthlyFeeGenerationJob.name]: monthlyFeeGenerationJob,
  [paymentReminderJob.name]: paymentReminderJob,
  [leaveNotificationJob.name]: leaveNotificationJob,
  [staleUploadCleanupJob.name]: staleUploadCleanupJob,
  [invoiceCleanupJob.name]: invoiceCleanupJob,
} as const

export type RegisteredJobName = keyof typeof jobRegistry

export function getRegisteredJob(name: RegisteredJobName) {
  return jobRegistry[name]
}
