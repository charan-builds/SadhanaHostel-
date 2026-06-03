import { z } from "zod"

import {
  dateOnlySchema,
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
  gender: z.string().trim().max(40).optional(),
  dateOfBirth: dateOnlySchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  parentName: z.string().trim().min(2).max(120),
  parentPhone: phoneSchema,
  parentEmail: optionalEmailSchema,
  emergencyContactName: z.string().trim().min(2).max(120),
  emergencyContactPhone: phoneSchema,
  permanentAddress: z.string().trim().min(10).max(500),
  aadhaarLast4: z.string().trim().regex(/^[0-9]{4}$/).optional(),
  collegeName: z.string().trim().max(160).optional(),
  courseName: z.string().trim().max(160).optional(),
  guardianRelation: z.string().trim().max(80).optional(),
})

function validateResidentAge(value: { dateOfBirth: string }, ctx: z.RefinementCtx) {
  const dob = new Date(`${value.dateOfBirth}T00:00:00.000Z`)

  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateOfBirth"],
      message: "Enter a valid date of birth.",
    })
    return
  }

  const now = new Date()
  const age =
    now.getUTCFullYear() -
    dob.getUTCFullYear() -
    (now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())
      ? 1
      : 0)

  if (age < 15) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateOfBirth"],
      message: "Resident must be at least 15 years old.",
    })
  }
}

export const onboardingProfileFormSchema = onboardingProfileBaseSchema
  .omit({ organizationId: true })
  .superRefine(validateResidentAge)

export const onboardingProfileSchema =
  onboardingProfileBaseSchema.superRefine(validateResidentAge)

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
