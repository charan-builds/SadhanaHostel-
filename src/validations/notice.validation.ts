import { z } from "zod"

import { Constants } from "@/types/database"

import {
  booleanLikeSchema,
  isoDateSchema,
  paginationSchema,
  uuidSchema,
} from "./common.validation"

export const noticeListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.cms_status_enum).optional(),
  audienceType: z.enum(["all", "hostel", "room", "residents", "roles"]).optional(),
  activeOnly: booleanLikeSchema.optional(),
  search: z.string().trim().max(120).optional(),
})

export const noticeTypes = [
  "general",
  "fee_updates",
  "hostel_rules",
  "maintenance",
  "emergency",
] as const

export const noticeAudienceFilterSchema = z
  .object({
    resident_ids: z.array(uuidSchema).max(500).optional(),
    residentIds: z.array(uuidSchema).max(500).optional(),
    room_ids: z.array(uuidSchema).max(500).optional(),
    roomIds: z.array(uuidSchema).max(500).optional(),
    roles: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .catchall(z.unknown())
  .transform((value) => {
    const normalized: Record<string, unknown> = { ...value }
    const residentIds = uniqueStrings([
      ...(value.resident_ids ?? []),
      ...(value.residentIds ?? []),
    ])
    const roomIds = uniqueStrings([
      ...(value.room_ids ?? []),
      ...(value.roomIds ?? []),
    ])

    delete normalized.residentIds
    delete normalized.roomIds

    if (residentIds.length > 0) {
      normalized.resident_ids = residentIds
    }

    if (roomIds.length > 0) {
      normalized.room_ids = roomIds
    }

    return normalized
  })

export const createNoticeSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(5).max(5000),
  status: z.enum(Constants.public.Enums.cms_status_enum).default("draft"),
  noticeType: z.enum(noticeTypes).default("general"),
  requiresAcknowledgement: z.boolean().default(false),
  audienceType: z.enum(["all", "hostel", "room", "residents", "roles"]).default("all"),
  audienceFilter: noticeAudienceFilterSchema.default({}),
  isPinned: z.boolean().default(false),
  expiresAt: isoDateSchema.optional(),
})

export const updateNoticeSchema = z.object({
  noticeId: uuidSchema,
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  title: z.string().trim().min(2).max(160).optional(),
  body: z.string().trim().min(5).max(5000).optional(),
  status: z.enum(Constants.public.Enums.cms_status_enum).optional(),
  noticeType: z.enum(noticeTypes).optional(),
  requiresAcknowledgement: z.boolean().optional(),
  audienceType: z.enum(["all", "hostel", "room", "residents", "roles"]).optional(),
  audienceFilter: noticeAudienceFilterSchema.optional(),
  isPinned: z.boolean().optional(),
  expiresAt: isoDateSchema.optional(),
  isActive: z.boolean().optional(),
})

export const markNoticeReadSchema = z.object({
  organizationId: uuidSchema,
})

export const acknowledgeNoticeSchema = markNoticeReadSchema

export type NoticeListInput = z.infer<typeof noticeListSchema>
export type CreateNoticeInput = z.input<typeof createNoticeSchema>
export type UpdateNoticeInput = z.input<typeof updateNoticeSchema>
export type MarkNoticeReadInput = z.input<typeof markNoticeReadSchema>
export type AcknowledgeNoticeInput = z.input<typeof acknowledgeNoticeSchema>

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values))
}
