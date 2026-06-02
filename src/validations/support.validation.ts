import { z } from "zod"

import { Constants } from "@/types/database"

import { paginationSchema, uuidSchema } from "./common.validation"

export const supportCategorySchema = z.enum([
  "onboarding",
  "payment",
  "invite",
  "upload",
  "room",
  "lost_found",
  "maintenance",
  "safety",
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
  workflow: z.string().trim().max(80).optional(),
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

export const residentPasswordResetRequestSchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
  phone: z
    .string()
    .trim()
    .min(8, "Enter the registered phone number.")
    .max(24, "Phone number is too long."),
  admissionNumber: z.string().trim().min(2).max(80).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
})

export const supportPasswordResetApprovalSchema = z.object({
  organizationId: uuidSchema,
  requestId: uuidSchema,
})

export const supportPublishNoticeSchema = z.object({
  organizationId: uuidSchema,
  requestId: uuidSchema,
  title: z.string().trim().min(2).max(160).optional(),
  body: z.string().trim().min(5).max(5000).optional(),
  audienceType: z.enum(["all", "hostel"]).default("hostel"),
  isPinned: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
})

export const operationalAlertsQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
})

export type SupportCategory = z.infer<typeof supportCategorySchema>
export type SupportRequestListInput = z.infer<typeof supportRequestListSchema>
export type SupportRequestCreateInput = z.infer<typeof supportRequestCreateSchema>
export type SupportRequestUpdateInput = z.infer<typeof supportRequestUpdateSchema>
export type ResidentPasswordResetRequestInput = z.infer<typeof residentPasswordResetRequestSchema>
export type SupportPasswordResetApprovalInput = z.infer<typeof supportPasswordResetApprovalSchema>
export type SupportPublishNoticeInput = z.infer<typeof supportPublishNoticeSchema>
export type OperationalAlertsQueryInput = z.infer<typeof operationalAlertsQuerySchema>
