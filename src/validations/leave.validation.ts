import { z } from "zod"

import { Constants } from "@/types/database"

import {
  dateOnlySchema,
  isoDateSchema,
  paginationSchema,
  phoneSchema,
  uuidSchema,
} from "./common.validation"

export const leaveListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  residentId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.leave_status_enum).optional(),
  fromDate: isoDateSchema.optional(),
  toDate: isoDateSchema.optional(),
})

export const leaveSettingsQuerySchema = z.object({
  organizationId: uuidSchema,
})

export const createLeaveRequestSchema = z
  .object({
    organizationId: uuidSchema,
    hostelId: uuidSchema,
    residentId: uuidSchema,
    fullName: z.string().trim().min(2).max(160),
    mobileNumber: phoneSchema,
    whatsappNumber: phoneSchema,
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
    reason: z.string().trim().min(5).max(1000),
    destination: z.string().trim().max(200).optional(),
    travelMode: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.toDate >= value.fromDate, {
    message: "Leave end date must be on or after start date.",
    path: ["toDate"],
  })

export const reviewLeaveRequestSchema = z.object({
  leaveRequestId: uuidSchema,
  organizationId: uuidSchema,
  status: z.enum(Constants.public.Enums.leave_status_enum).refine(
    (status) => status === "approved" || status === "rejected",
    "Review status must be approved or rejected."
  ),
  rejectionReason: z.string().trim().min(3).max(1000).optional(),
})

export type LeaveListInput = z.infer<typeof leaveListSchema>
export type LeaveSettingsQueryInput = z.infer<typeof leaveSettingsQuerySchema>
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>
