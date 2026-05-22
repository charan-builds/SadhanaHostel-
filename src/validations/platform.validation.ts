import { z } from "zod"

import { jsonObjectSchema, optionalEmailSchema, phoneSchema, uuidSchema } from "./common.validation"

const optionalText = (max = 240) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined)

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only.")

export const bootstrapAdminTenantSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  organizationPhone: phoneSchema.optional().or(z.literal("")).transform((value) => value || undefined),
  organizationEmail: optionalEmailSchema,
  organizationAddress: optionalText(240),
  organizationCity: optionalText(120),
  organizationState: optionalText(120),
  hostelName: z.string().trim().min(2).max(160).optional(),
  hostelPhone: phoneSchema.optional().or(z.literal("")).transform((value) => value || undefined),
  hostelEmail: optionalEmailSchema,
  hostelAddress: optionalText(240),
  hostelCity: optionalText(120),
  hostelState: optionalText(120),
  hostelCapacity: z.coerce.number().int().min(1).max(500).default(70),
  upiId: optionalText(120),
  paymentAccountName: optionalText(160),
  paymentInstructions: optionalText(2000),
})

export const updateOrganizationSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().trim().min(2).max(160).optional(),
  legalName: optionalText(180),
  billingEmail: optionalEmailSchema,
  contactPhone: phoneSchema.optional().or(z.literal("")).transform((value) => value || undefined),
  addressLine1: optionalText(240),
  addressLine2: optionalText(240),
  city: optionalText(120),
  state: optionalText(120),
  postalCode: optionalText(24),
  country: optionalText(80),
  settings: jsonObjectSchema.optional(),
})

export const hostelCreateSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9-]+$/),
  slug: slugSchema,
  phone: phoneSchema.optional().or(z.literal("")).transform((value) => value || undefined),
  email: optionalEmailSchema,
  addressLine1: optionalText(240),
  addressLine2: optionalText(240),
  city: optionalText(120),
  state: optionalText(120),
  postalCode: optionalText(24),
  capacity: z.coerce.number().int().min(0).max(1000).default(70),
  settings: jsonObjectSchema.default({}),
})

export const hostelUpdateSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  name: z.string().trim().min(2).max(160).optional(),
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9-]+$/).optional(),
  slug: slugSchema.optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional(),
  addressLine1: z.string().trim().max(240).optional(),
  addressLine2: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(24).optional(),
  capacity: z.coerce.number().int().min(0).max(1000).optional(),
  settings: jsonObjectSchema.optional(),
  isActive: z.boolean().optional(),
})
  .refine(
    (value) =>
      Object.entries(value).some(
        ([key, fieldValue]) =>
          key !== "organizationId" &&
          key !== "hostelId" &&
          fieldValue !== undefined
      ),
    "At least one hostel field is required."
  )

export const platformScopedSchema = z.object({
  organizationId: uuidSchema.optional(),
})

export type BootstrapAdminTenantInput = z.infer<typeof bootstrapAdminTenantSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type HostelCreateInput = z.infer<typeof hostelCreateSchema>
export type HostelUpdateInput = z.infer<typeof hostelUpdateSchema>
export type PlatformScopedInput = z.infer<typeof platformScopedSchema>
