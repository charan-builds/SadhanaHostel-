import { z } from "zod"

import { Constants } from "@/types/database"

import {
  isoDateSchema,
  moneySchema,
  paginationSchema,
  uuidSchema,
} from "./common.validation"

const upiTransactionReferenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(6, "UPI reference must be at least 6 characters.")
  .max(64, "UPI reference must be 64 characters or fewer.")
  .regex(
    /^[A-Z0-9][A-Z0-9._/-]+$/,
    "UPI reference can only contain letters, numbers, dots, dashes, slashes, and underscores."
  )

const upiIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .regex(
    /^[a-z0-9][a-z0-9.\-_]{1,80}@[a-z0-9][a-z0-9.\-_]{1,40}$/,
    "Enter a valid UPI ID, for example sadhanahostel@ibl."
  )

const utrRegexSchema = z
  .string()
  .trim()
  .min(8, "UTR regex is required.")
  .max(240, "UTR regex is too long.")
  .refine((value) => {
    try {
      // Validate admin-supplied regex at the boundary before it reaches DB.
      new RegExp(value)
      return true
    } catch {
      return false
    }
  }, "UTR regex must be a valid regular expression.")

const multipartBooleanSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === "true") {
    return true
  }

  if (normalized === "false") {
    return false
  }

  return value
}, z.boolean())

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
  transactionId: upiTransactionReferenceSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(256).optional(),
  manualReference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  isAdvance: multipartBooleanSchema.default(false),
  isPartial: multipartBooleanSchema.default(false),
})

export const submitUpiPaymentSchema = createPaymentSchema.extend({
  transactionId: upiTransactionReferenceSchema,
  idempotencyKey: z.string().trim().min(8).max(256),
})

export const verifyPaymentSchema = z.object({
  paymentId: uuidSchema,
  organizationId: uuidSchema,
  idempotencyKey: z.string().trim().min(8).max(256).optional(),
})

export const rejectPaymentSchema = z.object({
  paymentId: uuidSchema,
  organizationId: uuidSchema,
  reason: z.string().trim().min(6, "Rejection reason is required.").max(1000),
})

export const paymentSettingsQuerySchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
})

export const paymentSettingsSchema = z.object({
  id: uuidSchema.optional(),
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  paymentMethod: z.enum(["upi", "bank_transfer", "cash"]).default("upi"),
  accountName: z.string().trim().min(2).max(160),
  upiId: upiIdSchema.optional().or(z.literal("")),
  qrImagePath: z.string().trim().max(500).optional().or(z.literal("")),
  bankName: z.string().trim().max(160).optional().or(z.literal("")),
  branchName: z.string().trim().max(160).optional().or(z.literal("")),
  accountLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Account last 4 must contain exactly 4 digits.")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().default(true),
  supportsManualVerification: z.boolean().default(true),
  instructions: z.string().trim().max(2000).optional().or(z.literal("")),
  requireUtr: z.boolean().default(true),
  requireScreenshot: z.boolean().default(true),
  allowPartialPayment: z.boolean().default(true),
  allowAdvancePayment: z.boolean().default(true),
  autoExpirePendingPayments: z.boolean().default(true),
  minPaymentAmount: moneySchema.default(1),
  utrRegex: utrRegexSchema.default("^[A-Z0-9][A-Z0-9._/-]{5,63}$"),
  duplicateDetectionStrictness: z.enum(["standard", "strict"]).default("strict"),
  rotate: z.boolean().default(false),
  qrReplaced: z.boolean().default(false),
}).superRefine((value, context) => {
  if (
    value.paymentMethod === "upi" &&
    !value.upiId &&
    !value.qrImagePath
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["upiId"],
      message: "UPI ID or QR image is required for UPI payments.",
    })
  }

  if (value.requireUtr && !value.utrRegex) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["utrRegex"],
      message: "UTR regex is required when UTR is required.",
    })
  }
})

export const paymentSettingsHistorySchema = paymentSettingsQuerySchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export const paymentSettingsTestSchema = paymentSettingsSchema

export const paymentQrUploadSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
})

export const residentPaymentLedgerSchema = z.object({
  organizationId: uuidSchema,
  residentId: uuidSchema.optional(),
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
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>
export type PaymentSettingsQueryInput = z.infer<typeof paymentSettingsQuerySchema>
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>
export type PaymentSettingsHistoryInput = z.infer<typeof paymentSettingsHistorySchema>
export type PaymentSettingsTestInput = z.infer<typeof paymentSettingsTestSchema>
export type PaymentQrUploadInput = z.infer<typeof paymentQrUploadSchema>
export type ResidentPaymentLedgerInput = z.infer<typeof residentPaymentLedgerSchema>
export type GenerateMonthlyFeeInput = z.infer<typeof generateMonthlyFeeSchema>
