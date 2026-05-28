import { z } from "zod"

import { phoneSchema, uuidSchema } from "./common.validation"

export const createResidentInviteSchema = z.object({
  organizationId: uuidSchema,
  residentId: uuidSchema,
  expiresInHours: z.coerce.number().int().min(1).max(24 * 14).default(72),
  deliveryChannel: z
    .enum(["copy_link", "email", "whatsapp", "sms_ready", "temp_password"])
    .default("copy_link"),
})

export const listResidentInvitesSchema = z.object({
  organizationId: uuidSchema,
  residentId: uuidSchema.optional(),
})

export const residentInviteActionSchema = z.object({
  organizationId: uuidSchema,
  inviteId: uuidSchema,
})

export const inviteIdentityBaseSchema = z.object({
  token: z.string().trim().min(40).max(512).optional(),
  inviteCode: z.string().trim().toUpperCase().max(32).optional(),
  email: z.string().trim().email().optional(),
  phone: phoneSchema.optional(),
})

export const validateInviteSchema = inviteIdentityBaseSchema.refine(
  (value) => Boolean(value.token || value.inviteCode),
  {
    message: "Invite token or invite code is required.",
    path: ["token"],
  }
)

export const activateInviteSchema = inviteIdentityBaseSchema
  .extend({
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.token || value.email || value.phone, {
    message: "Email or phone is required when activating with an invite code.",
    path: ["email"],
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export type CreateResidentInviteInput = z.infer<typeof createResidentInviteSchema>
export type ListResidentInvitesInput = z.infer<typeof listResidentInvitesSchema>
export type ResidentInviteActionInput = z.infer<typeof residentInviteActionSchema>
export type ValidateInviteInput = z.infer<typeof validateInviteSchema>
export type ActivateInviteInput = z.infer<typeof activateInviteSchema>
