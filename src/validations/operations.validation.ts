import { z } from "zod"

import { uuidSchema } from "./common.validation"

export const automationJobNameSchema = z.enum([
  "monthly_fee_generation",
  "payment_reminder",
  "reservation_expiry",
  "resident_invite_expiry",
  "admission_follow_up",
  "inactive_inquiry_cleanup",
  "occupancy_recalculation",
  "leave_notification",
  "stale_upload_cleanup",
  "invoice_cleanup",
  "scheduled_notices",
  "consistency_validation",
  "onboarding_aging",
  "checkout_reconciliation",
])

export const automationDashboardQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
})

export const automationRunSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  name: automationJobNameSchema,
  dryRun: z.boolean().default(false),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const automationSettingsSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  name: automationJobNameSchema,
  enabled: z.boolean(),
  cronSchedule: z.string().trim().min(4).max(80),
  dryRunOnly: z.boolean().default(false),
})

export const consistencyReportQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
})

export const consistencyRepairSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  action: z.enum([
    "expire_reservations",
    "expire_invites",
    "cleanup_uploads",
    "recalculate_occupancy",
    "repair_tenant_linkage",
    "generate_fees",
    "run_consistency_scan",
  ]),
  dryRun: z.boolean().default(true),
})

export type AutomationJobName = z.infer<typeof automationJobNameSchema>
export type AutomationDashboardQueryInput = z.infer<typeof automationDashboardQuerySchema>
export type AutomationRunInput = z.infer<typeof automationRunSchema>
export type AutomationSettingsInput = z.infer<typeof automationSettingsSchema>
export type ConsistencyReportQueryInput = z.infer<typeof consistencyReportQuerySchema>
export type ConsistencyRepairInput = z.infer<typeof consistencyRepairSchema>
