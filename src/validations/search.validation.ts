import { z } from "zod"

import { paginationSchema, uuidSchema } from "./common.validation"

export const searchEntityTypes = [
  "residents",
  "payments",
  "rooms",
  "notices",
  "complaints",
  "reports",
] as const

export const searchEntitySchema = z.enum(searchEntityTypes)

export const globalSearchSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  query: z.string().trim().min(2).max(120),
  types: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [...searchEntityTypes]
    )
    .pipe(z.array(searchEntitySchema).min(1)),
})
