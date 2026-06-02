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

export const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  redirectTo: z.string().url().optional(),
})

export const strongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol.")

export const changePasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
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
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type AdminOnboardingInput = z.infer<typeof adminOnboardingSchema>
export type ResidentOnboardingInput = z.infer<typeof residentOnboardingSchema>
