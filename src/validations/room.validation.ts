import { z } from "zod"

import { Constants } from "@/types/database"

import { dateOnlySchema, moneySchema, paginationSchema, uuidSchema } from "./common.validation"

export const roomListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.room_status_enum).optional(),
  roomType: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
})

export const createRoomSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  roomNumber: z.string().trim().min(1).max(40),
  roomName: z.string().trim().max(120).optional(),
  roomType: z.string().trim().min(1).max(80).default("shared"),
  floor: z.string().trim().max(40).optional(),
  blockName: z.string().trim().max(80).optional(),
  capacity: z.coerce.number().int().positive().max(50),
  baseMonthlyFee: moneySchema.default(0),
  hasAttachedBathroom: z.boolean().default(false),
  hasAc: z.boolean().default(false),
  description: z.string().trim().max(1000).optional(),
})

export const allocateRoomSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema,
  roomId: uuidSchema,
  residentId: uuidSchema,
  bedLabel: z.string().trim().max(40).optional(),
  allocatedFrom: dateOnlySchema,
  allocatedTo: dateOnlySchema.optional(),
  monthlyFeeAmount: moneySchema.default(0),
  reason: z.string().trim().max(500).optional(),
})

export const updateRoomSchema = createRoomSchema
  .omit({
    organizationId: true,
    hostelId: true,
    roomNumber: true,
  })
  .partial()
  .extend({
    roomId: uuidSchema,
    organizationId: uuidSchema,
    status: z.enum(Constants.public.Enums.room_status_enum).optional(),
  })

export type RoomListInput = z.infer<typeof roomListSchema>
export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type AllocateRoomInput = z.infer<typeof allocateRoomSchema>
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>
