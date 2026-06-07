import { z } from "zod"

import { Constants } from "@/types/database"
import { notificationCategories, notificationPriorities } from "@/lib/notifications/catalog"

import { booleanLikeSchema, paginationSchema, uuidSchema } from "./common.validation"

export const notificationListSchema = paginationSchema.extend({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  status: z.enum(Constants.public.Enums.notification_status_enum).optional(),
  channel: z.enum(Constants.public.Enums.notification_channel_enum).optional(),
  category: z.enum(notificationCategories).optional(),
  priority: z.enum(notificationPriorities).optional(),
  unreadOnly: booleanLikeSchema.optional(),
  includeArchived: booleanLikeSchema.optional(),
})

export const markNotificationReadSchema = z.object({
  organizationId: uuidSchema,
})

export const markAllNotificationsReadSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
})

export const archiveNotificationSchema = z.object({
  organizationId: uuidSchema,
})

export type NotificationListInput = z.infer<typeof notificationListSchema>
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>
export type MarkAllNotificationsReadInput = z.infer<typeof markAllNotificationsReadSchema>
export type ArchiveNotificationInput = z.infer<typeof archiveNotificationSchema>
