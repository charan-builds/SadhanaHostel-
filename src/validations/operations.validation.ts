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
    "dedupe_invites",
    "release_stale_allocations",
    "resync_auth_linkage",
    "repair_analytics",
    "repair_financial_reconciliation",
    "reconcile_dues",
    "generate_fees",
    "run_consistency_scan",
  ]),
  dryRun: z.boolean().default(true),
})

export const DEMO_DATA_RESET_CONFIRMATION = "RESET DEMO DATA"

export const demoDataResetSchema = z
  .object({
    organizationId: uuidSchema,
    hostelId: uuidSchema.optional(),
    dryRun: z.boolean().default(true),
    confirmation: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.dryRun && value.confirmation !== DEMO_DATA_RESET_CONFIRMATION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmation"],
        message: `Type ${DEMO_DATA_RESET_CONFIRMATION} to reset demo/test data.`,
      })
    }
  })

export const identityReconciliationQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
})

export const identityRepairSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  action: z.enum([
    "repair_safe",
    "delete_orphan_auth",
    "scan_only",
  ]).default("repair_safe"),
  dryRun: z.boolean().default(true),
})

export const financialReconciliationActionSchema = z.enum([
  "repair_monthly_fee_invoices",
  "repair_advance_payment_invoices",
  "repair_receipt_invoice_links",
  "repair_all",
])

export const financialReconciliationRepairSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  action: financialReconciliationActionSchema.default("repair_all"),
  dryRun: z.boolean().default(true),
})

export const missingReceiptRegenerationSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  dryRun: z.boolean().default(true),
  limit: z.coerce.number().int().positive().max(500).default(100),
})

export type AutomationJobName = z.infer<typeof automationJobNameSchema>
export type AutomationDashboardQueryInput = z.infer<typeof automationDashboardQuerySchema>
export type AutomationRunInput = z.infer<typeof automationRunSchema>
export type AutomationSettingsInput = z.infer<typeof automationSettingsSchema>
export type ConsistencyReportQueryInput = z.infer<typeof consistencyReportQuerySchema>
export type ConsistencyRepairInput = z.infer<typeof consistencyRepairSchema>
export type DemoDataResetInput = z.infer<typeof demoDataResetSchema>
export type IdentityReconciliationQueryInput = z.infer<typeof identityReconciliationQuerySchema>
export type IdentityRepairInput = z.infer<typeof identityRepairSchema>
export type FinancialReconciliationRepairInput = z.infer<
  typeof financialReconciliationRepairSchema
>
export type MissingReceiptRegenerationInput = z.infer<
  typeof missingReceiptRegenerationSchema
>
