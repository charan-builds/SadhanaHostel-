import { z } from "zod"

import { Constants } from "@/types/database"

import { paginationSchema, uuidSchema } from "./common.validation"

export const supportCategorySchema = z.enum([
  "onboarding",
  "payment",
  "invite",
  "upload",
  "room",
  "account",
  "session",
  "general",
])

export const supportPrioritySchema = z.enum(
  Constants.public.Enums.support_priority_enum
)

export const supportStatusSchema = z.enum(
  Constants.public.Enums.support_status_enum
)

export const supportRequestListSchema = paginationSchema.extend({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
  status: supportStatusSchema.optional(),
  category: supportCategorySchema.optional(),
  priority: supportPrioritySchema.optional(),
  search: z.string().trim().max(120).optional(),
})

export const supportRequestCreateSchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
  category: supportCategorySchema.default("general"),
  priority: supportPrioritySchema.default("medium"),
  subject: z.string().trim().min(4, "Subject is required.").max(180),
  description: z.string().trim().min(10, "Describe what happened.").max(4000),
  workflow: z.string().trim().max(80).optional(),
  relatedRecordId: uuidSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(256).optional(),
})

export const supportRequestUpdateSchema = z.object({
  organizationId: uuidSchema,
  requestId: uuidSchema,
  status: supportStatusSchema.optional(),
  priority: supportPrioritySchema.optional(),
  assignedToUserId: uuidSchema.nullish(),
  resolutionNotes: z.string().trim().max(4000).optional(),
})

export const operationalAlertsQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
})

export type SupportCategory = z.infer<typeof supportCategorySchema>
export type SupportRequestListInput = z.infer<typeof supportRequestListSchema>
export type SupportRequestCreateInput = z.infer<typeof supportRequestCreateSchema>
export type SupportRequestUpdateInput = z.infer<typeof supportRequestUpdateSchema>
export type OperationalAlertsQueryInput = z.infer<typeof operationalAlertsQuerySchema>
