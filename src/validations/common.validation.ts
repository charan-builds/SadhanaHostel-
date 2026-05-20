import { z } from "zod"

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
  .min(8)
  .max(20)
  .regex(/^[+0-9\s-]+$/, "Phone number contains unsupported characters.")

export const optionalEmailSchema = z
  .string()
  .trim()
  .email()
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined)
