import "server-only"

import {
  invoiceCleanupJob,
  monthlyFeeGenerationJob,
  paymentReminderJob,
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
      dueBeforeDate: toDateOnly(now),
      limit: 200,
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
    schedule: "0 * * * *",
    maxDurationSeconds: 60,
    buildPayload: ({ organization, now }: CronBuildInput) => ({
      organizationId: organization.id,
      runAt: now.toISOString(),
      limit: 100,
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
