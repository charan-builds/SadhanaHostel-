import { z } from "zod"

import { Constants } from "@/types/database"

import {
  moneySchema,
  optionalEmailSchema,
  paginationSchema,
  phoneSchema,
  uuidSchema,
} from "./common.validation"

export const residentListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.resident_status_enum).optional(),
  residentType: z.enum(Constants.public.Enums.resident_type_enum).optional(),
  search: z.string().trim().max(120).optional(),
})

export const createResidentSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  admissionNumber: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(2).max(120),
  preferredName: z.string().trim().max(80).optional(),
  residentType: z.enum(Constants.public.Enums.resident_type_enum).default("student"),
  gender: z.string().trim().max(40).optional(),
  dateOfBirth: z.string().optional(),
  phone: phoneSchema.optional(),
  email: optionalEmailSchema,
  parentName: z.string().trim().max(120).optional(),
  parentPhone: phoneSchema.optional(),
  parentEmail: optionalEmailSchema,
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: phoneSchema.optional(),
  permanentAddress: z.string().trim().max(500).optional(),
  monthlyFeeAmount: moneySchema.default(0),
  securityDepositAmount: moneySchema.default(0),
  notes: z.string().trim().max(1000).optional(),
})

export const updateResidentSchema = createResidentSchema
  .omit({
    organizationId: true,
    hostelId: true,
    admissionNumber: true,
  })
  .partial()
  .extend({
    residentId: uuidSchema,
    organizationId: uuidSchema,
    status: z.enum(Constants.public.Enums.resident_status_enum).optional(),
  })

export const residentIdMutationSchema = z.object({
  residentId: uuidSchema,
  organizationId: uuidSchema,
})

export type ResidentListInput = z.infer<typeof residentListSchema>
export type CreateResidentInput = z.infer<typeof createResidentSchema>
export type UpdateResidentInput = z.infer<typeof updateResidentSchema>
export type ResidentIdMutationInput = z.infer<typeof residentIdMutationSchema>
