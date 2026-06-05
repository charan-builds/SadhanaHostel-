import { z } from "zod"

import { Constants } from "@/types/database"

import { booleanLikeSchema, paginationSchema, uuidSchema } from "./common.validation"

export const notificationListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.notification_status_enum).optional(),
  channel: z.enum(Constants.public.Enums.notification_channel_enum).optional(),
  unreadOnly: booleanLikeSchema.optional(),
})

export const markNotificationReadSchema = z.object({
  organizationId: uuidSchema,
})

export const markAllNotificationsReadSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
})

export type NotificationListInput = z.infer<typeof notificationListSchema>
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>
export type MarkAllNotificationsReadInput = z.infer<typeof markAllNotificationsReadSchema>
