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
    "support_attachment",
    "other",
  ]),
  isPublic: booleanLikeSchema.default(false),
})

export const uploadPaymentProofSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  residentId: uuidSchema,
  paymentId: uuidSchema.optional(),
})

export const uploadProfilePhotoSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema,
})

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>
export type UploadProfilePhotoInput = z.infer<typeof uploadProfilePhotoSchema>
