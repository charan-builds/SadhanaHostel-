import { z } from "zod"

import { Constants } from "@/types/database"

import { phoneSchema, uuidSchema } from "./common.validation"

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(3).max(160).optional(),
    email: z.string().trim().email().optional(),
    phone: phoneSchema.optional(),
    password: z.string().min(8),
    rememberSession: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.identifier || value.email || value.phone), {
    message: "Email or phone number is required.",
    path: ["identifier"],
  })

export const requestResidentPhoneOtpSchema = z.object({
  phone: phoneSchema,
})

export const verifyResidentPhoneOtpSchema = requestResidentPhoneOtpSchema.extend({
  token: z.string().trim().min(4).max(12),
  rememberSession: z.boolean().optional(),
})

export const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  redirectTo: z.string().url().optional(),
})

export const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: phoneSchema.optional(),
  password: z.string().min(8).max(128),
})

export const adminOnboardingSchema = z.object({
  userId: uuidSchema,
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  role: z.enum(Constants.public.Enums.user_role_enum).default("admin"),
})

export const residentOnboardingSchema = z.object({
  residentId: uuidSchema,
  userId: uuidSchema,
})

export type LoginInput = z.infer<typeof loginSchema>
export type RequestResidentPhoneOtpInput = z.infer<typeof requestResidentPhoneOtpSchema>
export type VerifyResidentPhoneOtpInput = z.infer<typeof verifyResidentPhoneOtpSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type AdminOnboardingInput = z.infer<typeof adminOnboardingSchema>
export type ResidentOnboardingInput = z.infer<typeof residentOnboardingSchema>
