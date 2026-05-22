import { z } from "zod"

import {
  dateOnlySchema,
  isoDateSchema,
  moneySchema,
  optionalEmailSchema,
  paginationSchema,
  phoneSchema,
  uuidSchema,
} from "./common.validation"

export const leadSourceValues = [
  "phone",
  "whatsapp",
  "website",
  "walk_in",
  "referral",
  "other",
] as const

export const leadStatusValues = [
  "new_inquiry",
  "called",
  "interested",
  "reserved",
  "confirmed",
  "waitlisted",
  "cancelled",
  "joined",
] as const

export const reservationStatusValues = [
  "pending",
  "reserved",
  "confirmed",
  "expired",
  "cancelled",
  "converted_to_resident",
] as const

export const reservationPaymentStatusValues = [
  "pending",
  "proof_uploaded",
  "verified",
  "rejected",
  "refunded",
  "cancelled",
] as const

export const residentTypeValues = ["student", "employee", "other"] as const

export const vacancyQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  hostelId: uuidSchema.optional(),
})

export const leadListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  status: z.enum(leadStatusValues).optional(),
  source: z.enum(leadSourceValues).optional(),
  search: z.string().trim().max(120).optional(),
  followUp: z.enum(["due", "upcoming"]).optional(),
})

export const createLeadSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  whatsappNumber: phoneSchema.optional(),
  email: optionalEmailSchema,
  residentType: z.enum(residentTypeValues).default("student"),
  desiredJoiningDate: dateOnlySchema.optional(),
  expectedStayDuration: z.string().trim().max(120).optional(),
  parentName: z.string().trim().max(120).optional(),
  parentPhone: phoneSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(leadSourceValues).default("website"),
  status: z.enum(leadStatusValues).default("new_inquiry"),
  nextFollowUpAt: isoDateSchema.optional(),
})

export const publicInquirySchema = createLeadSchema
  .omit({
    organizationId: true,
    hostelId: true,
    status: true,
    source: true,
    nextFollowUpAt: true,
  })
  .extend({
    organizationId: uuidSchema.optional(),
    hostelId: uuidSchema.optional(),
    source: z.enum(["website", "whatsapp", "phone"]).default("website"),
    company: z.string().trim().max(0).optional(),
  })

export const updateLeadSchema = createLeadSchema
  .omit({
    fullName: true,
    phone: true,
    organizationId: true,
  })
  .partial()
  .extend({
    leadId: uuidSchema,
    organizationId: uuidSchema,
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: phoneSchema.optional(),
    status: z.enum(leadStatusValues).optional(),
    assignedTo: uuidSchema.optional(),
    lastContactedAt: isoDateSchema.optional(),
    cancelledReason: z.string().trim().max(500).optional(),
  })

export const addLeadNoteSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  leadId: uuidSchema,
  note: z.string().trim().min(1).max(2000),
  isPinned: z.boolean().default(false),
})

export const reservationListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  status: z.enum(reservationStatusValues).optional(),
  leadId: uuidSchema.optional(),
  roomId: uuidSchema.optional(),
  search: z.string().trim().max(120).optional(),
})

export const createReservationSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  leadId: uuidSchema,
  reservedRoomId: uuidSchema.optional(),
  reservedBedCount: z.coerce.number().int().positive().max(10).default(1),
  reservedUntil: isoDateSchema,
  advanceAmount: moneySchema.default(0),
  notes: z.string().trim().max(1000).optional(),
})

export const reservationIdSchema = z.object({
  organizationId: uuidSchema,
  reservationId: uuidSchema,
})

export const cancelReservationSchema = reservationIdSchema.extend({
  reason: z.string().trim().max(500).optional(),
})

export const createReservationPaymentSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  reservationId: uuidSchema,
  leadId: uuidSchema,
  amount: moneySchema.refine((value) => value > 0, "Amount must be greater than zero."),
  method: z.enum(["upi", "cash", "bank_transfer", "advance"]).default("upi"),
  transactionId: z.string().trim().max(120).optional(),
  proofDocumentId: uuidSchema.optional(),
  paidAt: isoDateSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
})

export const verifyReservationPaymentSchema = z.object({
  organizationId: uuidSchema,
  paymentId: uuidSchema,
  notes: z.string().trim().max(1000).optional(),
})

export const convertReservationSchema = reservationIdSchema.extend({
  joinedOn: dateOnlySchema.default(new Date().toISOString().slice(0, 10)),
  monthlyFeeAmount: moneySchema.optional(),
  securityDepositAmount: moneySchema.default(0),
})

export type VacancyQueryInput = z.infer<typeof vacancyQuerySchema>
export type LeadListInput = z.infer<typeof leadListSchema>
export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type PublicInquiryInput = z.infer<typeof publicInquirySchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type AddLeadNoteInput = z.infer<typeof addLeadNoteSchema>
export type ReservationListInput = z.infer<typeof reservationListSchema>
export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type ReservationIdInput = z.infer<typeof reservationIdSchema>
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>
export type CreateReservationPaymentInput = z.infer<typeof createReservationPaymentSchema>
export type VerifyReservationPaymentInput = z.infer<typeof verifyReservationPaymentSchema>
export type ConvertReservationInput = z.infer<typeof convertReservationSchema>
