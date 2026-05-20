import { z } from "zod"

import { Constants } from "@/types/database"

import {
  booleanLikeSchema,
  isoDateSchema,
  jsonObjectSchema,
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

export const createNoticeSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(5).max(5000),
  status: z.enum(Constants.public.Enums.cms_status_enum).default("draft"),
  audienceType: z.enum(["all", "hostel", "room", "residents", "roles"]).default("all"),
  audienceFilter: jsonObjectSchema.default({}),
  isPinned: z.boolean().default(false),
  expiresAt: isoDateSchema.optional(),
})

export const updateNoticeSchema = createNoticeSchema
  .omit({
    organizationId: true,
  })
  .partial()
  .extend({
    noticeId: uuidSchema,
    organizationId: uuidSchema,
    isActive: z.boolean().optional(),
  })

export type NoticeListInput = z.infer<typeof noticeListSchema>
export type CreateNoticeInput = z.infer<typeof createNoticeSchema>
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>
