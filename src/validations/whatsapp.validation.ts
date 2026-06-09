import { z } from "zod"

import { phoneSchema, uuidSchema } from "./common.validation"

export const whatsappEventKeySchema = z.enum([
  "admission_created",
  "resident_activated",
  "monthly_invoice_generated",
  "payment_received",
  "payment_verified",
  "leave_submitted",
  "leave_approved",
  "leave_rejected",
  "notice_published",
  "checkout_completed",
])

export const whatsappAutomationQuerySchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
})

export const whatsappTemplateSaveSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  templateId: uuidSchema.optional(),
  eventKey: whatsappEventKeySchema,
  name: z.string().trim().min(2).max(120),
  bodyTemplate: z.string().trim().min(3).max(2000),
  enabled: z.boolean().default(true),
})

export const whatsappTemplatePreviewSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  templateId: uuidSchema.optional(),
  eventKey: whatsappEventKeySchema.optional(),
  bodyTemplate: z.string().trim().min(3).max(2000).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const whatsappQueueEventSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  eventKey: whatsappEventKeySchema,
  residentId: uuidSchema.optional(),
  recipientUserId: uuidSchema.optional(),
  phone: phoneSchema.optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(8).max(256).optional(),
  scheduledFor: z.string().datetime().optional(),
})

export const whatsappProcessQueueSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const whatsappTestSendSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  templateId: uuidSchema.optional(),
  eventKey: whatsappEventKeySchema,
  phone: phoneSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
})

export type WhatsappAutomationQueryInput = z.infer<typeof whatsappAutomationQuerySchema>
export type WhatsappTemplateSaveInput = z.input<typeof whatsappTemplateSaveSchema>
export type WhatsappTemplatePreviewInput = z.input<typeof whatsappTemplatePreviewSchema>
export type WhatsappQueueEventInput = z.input<typeof whatsappQueueEventSchema>
export type WhatsappProcessQueueInput = z.input<typeof whatsappProcessQueueSchema>
export type WhatsappTestSendInput = z.input<typeof whatsappTestSendSchema>
export type WhatsappEventKey = z.infer<typeof whatsappEventKeySchema>
