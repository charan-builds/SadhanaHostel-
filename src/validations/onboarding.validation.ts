import { z } from "zod"

import {
  optionalEmailSchema,
  paginationSchema,
  phoneSchema,
  uuidSchema,
} from "./common.validation"

export const residentOnboardingStatuses = [
  "invited",
  "activated",
  "profile_incomplete",
  "documents_pending",
  "verification_pending",
  "verified",
  "rejected",
  "suspended",
] as const

export const onboardingProfileBaseSchema = z.object({
  organizationId: uuidSchema,
  fullName: z.string().trim().min(2).max(120),
  preferredName: z.string().trim().max(80).optional(),
  phone: phoneSchema,
  email: optionalEmailSchema,
  parentPhone: phoneSchema,
  emergencyContactPhone: phoneSchema,
  permanentAddress: z.string().trim().min(10).max(500),
  collegeName: z.string().trim().max(160).optional(),
  courseName: z.string().trim().max(160).optional(),
})

export const onboardingProfileFormSchema = onboardingProfileBaseSchema.omit({
  organizationId: true,
})

export const onboardingProfileSchema = onboardingProfileBaseSchema

export const onboardingStatusQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
})

export const onboardingSubmitSchema = z.object({
  organizationId: uuidSchema,
  rulesAccepted: z.literal(true, {
    message: "Accept hostel rules and regulations before continuing.",
  }),
})

export const onboardingQueueSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  search: z.string().trim().max(120).optional(),
  onboardingStatus: z.enum(residentOnboardingStatuses).optional(),
})

export const onboardingReviewSchema = z.object({
  organizationId: uuidSchema,
  residentId: uuidSchema,
  status: z.enum(["verified", "rejected", "suspended"]),
  rejectionReason: z.string().trim().max(1000).optional(),
})

export type ResidentOnboardingStatus = (typeof residentOnboardingStatuses)[number]
export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>
export type OnboardingStatusQueryInput = z.infer<typeof onboardingStatusQuerySchema>
export type OnboardingSubmitInput = z.infer<typeof onboardingSubmitSchema>
export type OnboardingQueueInput = z.infer<typeof onboardingQueueSchema>
export type OnboardingReviewInput = z.infer<typeof onboardingReviewSchema>
