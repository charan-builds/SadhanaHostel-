import { z } from "zod"

import { uuidSchema } from "./common.validation"
import { automationRunSchema } from "./operations.validation"

export const financeDashboardSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
})

export const financeAutomationJobNameSchema = z.enum([
  "monthly_fee_generation",
  "payment_reminder",
])

export const financeAutomationRunSchema = automationRunSchema.extend({
  name: financeAutomationJobNameSchema,
})

export const collectionFollowupStatusSchema = z.enum(["open", "completed", "cancelled"])
export const collectionFollowupPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
])

export const collectionFollowupListSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
  status: collectionFollowupStatusSchema.optional(),
  priority: collectionFollowupPrioritySchema.optional(),
  assignedTo: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const collectionFollowupCreateSchema = z
  .object({
    organizationId: uuidSchema,
    hostelId: uuidSchema.optional(),
    residentId: uuidSchema,
    note: z.string().trim().min(1).max(2000).optional(),
    notes: z.string().trim().min(1).max(2000).optional(),
    priority: collectionFollowupPrioritySchema.default("medium"),
    assignedTo: uuidSchema.optional().nullable(),
    nextFollowupAt: z.string().datetime().optional(),
    status: collectionFollowupStatusSchema.default("open"),
  })
  .superRefine((value, context) => {
    if (!value.note && !value.notes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message: "Follow-up notes are required.",
      })
    }
  })

export const collectionFollowupCompleteSchema = z.object({
  organizationId: uuidSchema,
  followupId: uuidSchema,
  note: z.string().trim().min(1).max(2000).optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
})

export type FinanceDashboardInput = z.infer<typeof financeDashboardSchema>
export type FinanceAutomationRunInput = z.infer<typeof financeAutomationRunSchema>
export type CollectionFollowupListInput = z.infer<typeof collectionFollowupListSchema>
export type CollectionFollowupCreateInput = z.input<typeof collectionFollowupCreateSchema>
export type CollectionFollowupCompleteInput = z.input<typeof collectionFollowupCompleteSchema>
export type CollectionFollowupPriority = z.infer<typeof collectionFollowupPrioritySchema>
