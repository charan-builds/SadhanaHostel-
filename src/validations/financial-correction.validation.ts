import { z } from "zod"

import { moneySchema, uuidSchema } from "./common.validation"

const correctionReasonSchema = z
  .string()
  .trim()
  .min(6, "A clear correction reason is required.")
  .max(1000)

const financialCorrectionBaseSchema = z.object({
  organizationId: uuidSchema,
  residentId: uuidSchema,
  newValue: moneySchema,
  reason: correctionReasonSchema,
})

export const financialCorrectionSchema = z.discriminatedUnion("changeType", [
  financialCorrectionBaseSchema.extend({
    changeType: z.literal("monthly_fee"),
    newValue: moneySchema.refine(
      (value) => value > 0,
      "Monthly fee must be greater than 0."
    ),
  }),
  financialCorrectionBaseSchema.extend({
    changeType: z.literal("advance_balance"),
  }),
])

export type FinancialCorrectionInput = z.infer<
  typeof financialCorrectionSchema
>

export const financialCorrectionResultSchema = z.object({
  residentId: uuidSchema,
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  changeType: z.enum(["monthly_fee", "advance_balance"]),
  oldValue: moneySchema,
  newValue: moneySchema,
  delta: z.number(),
  reason: z.string(),
  auditLogId: uuidSchema,
  correctionRecordId: uuidSchema,
  correctedAt: z.iso.datetime({ offset: true }),
})

export type FinancialCorrectionResult = z.infer<
  typeof financialCorrectionResultSchema
>
