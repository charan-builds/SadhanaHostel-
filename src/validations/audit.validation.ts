import { z } from "zod"

import { isoDateSchema, paginationSchema, uuidSchema } from "./common.validation"

export const auditCategorySchema = z.enum([
  "activity",
  "payments",
  "residents",
  "security",
  "logins",
])

export const auditListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  actorUserId: uuidSchema.optional(),
  recordId: uuidSchema.optional(),
  tableName: z.string().trim().max(120).optional(),
  action: z.string().trim().max(160).optional(),
  fromDate: isoDateSchema.optional(),
  toDate: isoDateSchema.optional(),
})

export type AuditCategory = z.infer<typeof auditCategorySchema>
export type AuditListInput = z.infer<typeof auditListSchema>
