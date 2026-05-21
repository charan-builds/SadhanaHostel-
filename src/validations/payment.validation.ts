import { z } from "zod"

import { Constants } from "@/types/database"

import {
  isoDateSchema,
  moneySchema,
  paginationSchema,
  uuidSchema,
} from "./common.validation"

export const paymentListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.payment_status_enum).optional(),
  method: z.enum(Constants.public.Enums.payment_method_enum).optional(),
  fromDate: isoDateSchema.optional(),
  toDate: isoDateSchema.optional(),
})

export const createPaymentSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  residentId: uuidSchema,
  monthlyFeeRecordId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
  amount: moneySchema,
  method: z.literal("upi").default("upi"),
  transactionId: z.string().trim().max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(256).optional(),
  manualReference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  isAdvance: z.boolean().default(false),
  isPartial: z.boolean().default(false),
})

export const submitUpiPaymentSchema = createPaymentSchema.extend({
  transactionId: z.string().trim().min(3).max(120),
  idempotencyKey: z.string().trim().min(8).max(256),
})

export const verifyPaymentSchema = z.object({
  paymentId: uuidSchema,
  organizationId: uuidSchema,
  idempotencyKey: z.string().trim().min(8).max(256).optional(),
})

export const generateMonthlyFeeSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  residentId: uuidSchema,
  roomAllocationId: uuidSchema.optional(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}-01$/, "Use first day of fee month."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD due date."),
  baseAmount: moneySchema,
  discountAmount: moneySchema.default(0),
  penaltyAmount: moneySchema.default(0),
  adjustmentAmount: moneySchema.default(0),
  advanceAdjustmentAmount: moneySchema.default(0),
  notes: z.string().trim().max(1000).optional(),
})

export type PaymentListInput = z.infer<typeof paymentListSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type SubmitUpiPaymentInput = z.infer<typeof submitUpiPaymentSchema>
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>
export type GenerateMonthlyFeeInput = z.infer<typeof generateMonthlyFeeSchema>
