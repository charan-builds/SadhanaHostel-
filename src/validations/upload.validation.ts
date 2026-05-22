import { z } from "zod"

import { booleanLikeSchema, uuidSchema } from "./common.validation"

export const uploadDocumentSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema,
  documentType: z.enum([
    "aadhaar",
    "profile_image",
    "guardian_id",
    "hostel_agreement",
    "payment_receipt",
    "student_id",
    "support_attachment",
    "other",
  ]),
  isPublic: booleanLikeSchema.default(false),
})

export const uploadPaymentProofSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  residentId: uuidSchema,
  paymentId: uuidSchema,
})

export const uploadProfilePhotoSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema,
})

export const paymentProofLookupSchema = z.object({
  organizationId: uuidSchema,
  paymentId: uuidSchema,
  expiresInSeconds: z.coerce.number().int().positive().max(3600).default(900),
})

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>
export type UploadProfilePhotoInput = z.infer<typeof uploadProfilePhotoSchema>
export type PaymentProofLookupInput = z.infer<typeof paymentProofLookupSchema>
