import "server-only"

import {
  invoiceCleanupJob,
  admissionFollowUpJob,
  checkoutReconciliationJob,
  consistencyValidationJob,
  inactiveInquiryCleanupJob,
  monthlyFeeGenerationJob,
  onboardingAgingJob,
  occupancyRecalculationJob,
  paymentReminderJob,
  reservationExpiryJob,
  residentInviteExpiryJob,
  scheduledNoticesJob,
  staleUploadCleanupJob,
  type JobDefinition,
} from "@/jobs"
import type { OrganizationRow } from "@/repositories/organizations.repository"

type CronPayloadBuilder<TPayload> = (input: {
  organization: OrganizationRow
  now: Date
}) => TPayload

type CronBuildInput = Parameters<CronPayloadBuilder<unknown>>[0]

export type CronSchedule<TPayload = Record<string, unknown>> = {
  name: string
  job: JobDefinition<TPayload>
  description: string
  schedule: string
  maxDurationSeconds: number
  buildPayload: CronPayloadBuilder<TPayload>
}

export const cronRegistry = {
  "monthly-fee-generation": {
    name: "monthly-fee-generation",
    job: monthlyFeeGenerationJob,
    description: "Generate monthly fee records for active residents.",
    schedule: "30 0 1 * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization, now }: CronBuildInput) => ({
      organizationId: organization.id,
      periodMonth: toFirstDayOfMonth(now),
    }),
  },
  "payment-reminders": {
    name: "payment-reminders",
    job: paymentReminderJob,
    description: "Queue payment reminders for overdue and due fee records.",
    schedule: "0 2 * * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization, now }: CronBuildInput) => ({
      organizationId: organization.id,
      dueBeforeDate: toDateOnly(addDays(now, 7)),
      runDate: toDateOnly(now),
      limit: 200,
    }),
  },
  "reservation-expiry": {
    name: "reservation-expiry",
    job: reservationExpiryJob,
    description: "Expire stale admissions reservations and release held beds.",
    schedule: "15 1 * * *",
    maxDurationSeconds: 45,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      limit: 200,
    }),
  },
  "resident-invite-expiry": {
    name: "resident-invite-expiry",
    job: residentInviteExpiryJob,
    description: "Expire stale resident activation invites.",
    schedule: "30 1 * * *",
    maxDurationSeconds: 45,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      limit: 500,
    }),
  },
  "admission-follow-ups": {
    name: "admission-follow-ups",
    job: admissionFollowUpJob,
    description: "Identify due inquiry follow-ups for admissions staff.",
    schedule: "0 4 * * *",
    maxDurationSeconds: 45,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      limit: 100,
    }),
  },
  "inactive-inquiry-cleanup": {
    name: "inactive-inquiry-cleanup",
    job: inactiveInquiryCleanupJob,
    description: "Auto-close stale inquiries after a long inactivity window.",
    schedule: "30 4 * * *",
    maxDurationSeconds: 45,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      olderThanDays: 90,
    }),
  },
  "occupancy-recalculation": {
    name: "occupancy-recalculation",
    job: occupancyRecalculationJob,
    description: "Recalculate vacancy snapshots for dashboards.",
    schedule: "45 1 * * *",
    maxDurationSeconds: 45,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
    }),
  },
  "invoice-cleanup": {
    name: "invoice-cleanup",
    job: invoiceCleanupJob,
    description: "Scan immutable cancelled invoices for retention cleanup review.",
    schedule: "0 3 * * 0",
    maxDurationSeconds: 45,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      olderThanDays: 90,
    }),
  },
  "stale-upload-cleanup": {
    name: "stale-upload-cleanup",
    job: staleUploadCleanupJob,
    description: "Remove stale pending upload objects and soft-delete metadata.",
    schedule: "30 3 * * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      olderThanHours: 24,
    }),
  },
  "scheduled-notices": {
    name: "scheduled-notices",
    job: scheduledNoticesJob,
    description: "Fan out published notices into resident notifications.",
    schedule: "0 5 * * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization, now }: CronBuildInput) => ({
      organizationId: organization.id,
      runAt: now.toISOString(),
      limit: 100,
    }),
  },
  "consistency-validation": {
    name: "consistency-validation",
    job: consistencyValidationJob,
    description: "Scan operational consistency and record findings for admin review.",
    schedule: "15 1 * * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      persist: true,
    }),
  },
  "onboarding-aging": {
    name: "onboarding-aging",
    job: onboardingAgingJob,
    description: "Notify residents and admins about stale incomplete onboarding.",
    schedule: "45 2 * * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
      olderThanDays: 7,
      limit: 100,
    }),
  },
  "checkout-reconciliation": {
    name: "checkout-reconciliation",
    job: checkoutReconciliationJob,
    description: "Release room allocations for checked-out residents.",
    schedule: "20 3 * * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization }: CronBuildInput) => ({
      organizationId: organization.id,
    }),
  },
} as const

export type CronName = keyof typeof cronRegistry

export function getCronSchedule(name: string) {
  return cronRegistry[name as CronName] ?? null
}

function toFirstDayOfMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)

  next.setUTCDate(next.getUTCDate() + days)

  return next
}
