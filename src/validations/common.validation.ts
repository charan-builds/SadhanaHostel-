import { z } from "zod"

import { PhoneNormalizationError, normalizePhoneNumber } from "@/lib/identity"

export const uuidSchema = z.string().uuid()

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date.")

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")

export const moneySchema = z.coerce.number().finite().nonnegative()

export const booleanLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true
    }

    if (value.toLowerCase() === "false") {
      return false
    }
  }

  return value
}, z.boolean())

export const jsonObjectSchema = z.record(z.string(), z.unknown())

export const phoneSchema = z
  .string()
  .trim()
  .min(8, "Phone number is too short.")
  .max(24, "Phone number is too long.")
  .transform((value, ctx) => {
    try {
      return normalizePhoneNumber(value)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof PhoneNormalizationError
            ? error.message
            : "Enter a valid Indian mobile number.",
      })

      return z.NEVER
    }
  })

export const optionalEmailSchema = z
  .string()
  .trim()
  .email()
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined)
