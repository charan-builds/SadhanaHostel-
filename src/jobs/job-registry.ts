import { invoiceCleanupJob } from "./invoice-cleanup.job"
import { admissionFollowUpJob } from "./admission-follow-up.job"
import { inactiveInquiryCleanupJob } from "./inactive-inquiry-cleanup.job"
import { leaveNotificationJob } from "./leave-notification.job"
import { monthlyFeeGenerationJob } from "./monthly-fee-generation.job"
import { occupancyRecalculationJob } from "./occupancy-recalculation.job"
import { paymentReminderJob } from "./payment-reminder.job"
import { reservationExpiryJob } from "./reservation-expiry.job"
import { scheduledNoticesJob } from "./scheduled-notices.job"
import { staleUploadCleanupJob } from "./stale-upload-cleanup.job"

export const jobRegistry = {
  [monthlyFeeGenerationJob.name]: monthlyFeeGenerationJob,
  [reservationExpiryJob.name]: reservationExpiryJob,
  [admissionFollowUpJob.name]: admissionFollowUpJob,
  [inactiveInquiryCleanupJob.name]: inactiveInquiryCleanupJob,
  [occupancyRecalculationJob.name]: occupancyRecalculationJob,
  [paymentReminderJob.name]: paymentReminderJob,
  [leaveNotificationJob.name]: leaveNotificationJob,
  [staleUploadCleanupJob.name]: staleUploadCleanupJob,
  [invoiceCleanupJob.name]: invoiceCleanupJob,
  [scheduledNoticesJob.name]: scheduledNoticesJob,
} as const

export type RegisteredJobName = keyof typeof jobRegistry

export function getRegisteredJob(name: RegisteredJobName) {
  return jobRegistry[name]
}
