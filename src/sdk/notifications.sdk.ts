import { apiClient } from "@/lib/api-client"
import type { NotificationRow } from "@/repositories/notifications.repository"
import type {
  MarkAllNotificationsReadInput,
  MarkNotificationReadInput,
  NotificationListInput,
} from "@/validations/notification.validation"

import type { PaginatedResult } from "./types"

export const notificationsSdk = {
  list(params: NotificationListInput) {
    return apiClient.get<PaginatedResult<NotificationRow>>("/api/notifications", params)
  },
  markRead(notificationId: string, input: MarkNotificationReadInput) {
    return apiClient.post<NotificationRow, MarkNotificationReadInput>(
      `/api/notifications/${notificationId}/read`,
      input,
      { retry: 0 }
    )
  },
  markAllRead(input: MarkAllNotificationsReadInput) {
    return apiClient.post<{ updated: number }, MarkAllNotificationsReadInput>(
      "/api/notifications/read-all",
      input,
      { retry: 0 }
    )
  },
}
