import { apiClient } from "@/lib/api-client"
import type { NotificationRow } from "@/repositories/notifications.repository"
import type {
  ArchiveNotificationInput,
  MarkAllNotificationsReadInput,
  MarkNotificationReadInput,
  NotificationListInput,
} from "@/validations/notification.validation"
import type {
  RevokePushSubscriptionInput,
  SubscribePushInput,
} from "@/validations/pwa.validation"

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
  archive(notificationId: string, input: ArchiveNotificationInput) {
    return apiClient.post<NotificationRow, ArchiveNotificationInput>(
      `/api/notifications/${notificationId}/archive`,
      input,
      { retry: 0 }
    )
  },
  subscribePush(input: SubscribePushInput) {
    return apiClient.post<unknown, SubscribePushInput>(
      "/api/notifications/push-subscriptions",
      input,
      { retry: 0 }
    )
  },
  revokePush(input: RevokePushSubscriptionInput) {
    return apiClient.post<{ revoked: number }, RevokePushSubscriptionInput>(
      "/api/notifications/push-subscriptions/revoke",
      input,
      { retry: 0 }
    )
  },
}
