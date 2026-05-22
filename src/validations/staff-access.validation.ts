import { z } from "zod"

import { Constants } from "@/types/database"

import { paginationSchema, phoneSchema, uuidSchema } from "./common.validation"

export const staffRoles = [
  "owner",
  "admin",
  "finance",
  "receptionist",
  "warden",
  "staff",
] as const

export const staffAccountStates = [
  "invited",
  "active",
  "suspended",
  "locked",
  "deleted",
] as const

export const staffDeliveryModes = ["invite_link", "temp_password"] as const

export const listStaffUsersSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  role: z.enum(staffRoles).optional(),
  status: z.enum(staffAccountStates).optional(),
  search: z.string().trim().max(120).optional(),
})

export const createStaffUserSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  phone: phoneSchema.optional().or(z.literal("")).transform((value) => value || undefined),
  role: z.enum(staffRoles),
  deliveryMode: z.enum(staffDeliveryModes).default("invite_link"),
  permissions: z.array(z.string().trim().min(2).max(120)).default([]),
  expiresInHours: z.coerce.number().int().min(1).max(168).default(72),
})

export const updateStaffAccessSchema = z.object({
  organizationId: uuidSchema,
  targetUserId: uuidSchema,
  roleAssignmentId: uuidSchema.optional(),
  hostelId: uuidSchema.optional().nullable(),
  role: z.enum(staffRoles).optional(),
  status: z.enum(staffAccountStates).optional(),
  permissions: z.array(z.string().trim().min(2).max(120)).optional(),
})

export const staffAccessActionSchema = z.object({
  organizationId: uuidSchema,
  targetUserId: uuidSchema,
})

export const roleEnumSchema = z.enum(Constants.public.Enums.user_role_enum)

export type ListStaffUsersInput = z.infer<typeof listStaffUsersSchema>
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>
export type UpdateStaffAccessInput = z.infer<typeof updateStaffAccessSchema>
export type StaffAccessActionInput = z.infer<typeof staffAccessActionSchema>
export type StaffRole = z.infer<typeof createStaffUserSchema>["role"]
export type StaffAccountState = z.infer<typeof updateStaffAccessSchema>["status"]
export type StaffDeliveryMode = z.infer<typeof createStaffUserSchema>["deliveryMode"]
