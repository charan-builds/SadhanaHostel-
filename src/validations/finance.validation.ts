import { z } from "zod"

import { dateOnlySchema, moneySchema, uuidSchema } from "./common.validation"
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

export const advanceLedgerQuerySchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
})

export const advanceDepositCreateSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  residentId: uuidSchema,
  amount: moneySchema.refine((value) => value > 0, "Advance amount must be greater than 0."),
  paymentMode: z.enum(["cash", "upi", "bank_transfer"]).default("cash"),
  transactionId: z.string().trim().min(3).max(120).optional().or(z.literal("")),
  receivedDate: dateOnlySchema.default(() => new Date().toISOString().slice(0, 10)),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  idempotencyKey: z.string().trim().min(8).max(256).optional(),
})

export const advanceAllocationRunSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export const advanceRefundCreateSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  residentId: uuidSchema,
  amount: moneySchema.refine((value) => value > 0, "Refund amount must be greater than 0."),
  reason: z.string().trim().min(3).max(1000),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})

export const advanceRefundApproveSchema = z.object({
  organizationId: uuidSchema,
  refundId: uuidSchema,
  action: z.enum(["approve", "reject", "mark_paid"]),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})

export const advanceReportsSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
})

export const advanceSettlementSchema = z.object({
  organizationId: uuidSchema,
  residentId: uuidSchema,
})

export type FinanceDashboardInput = z.infer<typeof financeDashboardSchema>
export type FinanceAutomationRunInput = z.infer<typeof financeAutomationRunSchema>
export type CollectionFollowupListInput = z.infer<typeof collectionFollowupListSchema>
export type CollectionFollowupCreateInput = z.input<typeof collectionFollowupCreateSchema>
export type CollectionFollowupCompleteInput = z.input<typeof collectionFollowupCompleteSchema>
export type CollectionFollowupPriority = z.infer<typeof collectionFollowupPrioritySchema>
export type AdvanceLedgerQueryInput = z.infer<typeof advanceLedgerQuerySchema>
export type AdvanceDepositCreateInput = z.input<typeof advanceDepositCreateSchema>
export type AdvanceAllocationRunInput = z.input<typeof advanceAllocationRunSchema>
export type AdvanceRefundCreateInput = z.input<typeof advanceRefundCreateSchema>
export type AdvanceRefundApproveInput = z.input<typeof advanceRefundApproveSchema>
export type AdvanceReportsInput = z.input<typeof advanceReportsSchema>
export type AdvanceSettlementInput = z.input<typeof advanceSettlementSchema>
