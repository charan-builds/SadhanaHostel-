import { z } from "zod"

import { paginationSchema, uuidSchema } from "./common.validation"

export const searchEntitySchema = z.enum([
  "residents",
  "payments",
  "rooms",
  "notices",
])

export const globalSearchSchema = paginationSchema.extend({
  organizationId: uuidSchema,
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
        : ["residents", "payments", "rooms", "notices"]
    )
    .pipe(z.array(searchEntitySchema).min(1)),
})
