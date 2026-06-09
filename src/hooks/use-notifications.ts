"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { notificationsSdk } from "@/sdk"
import type {
  MarkAllNotificationsReadInput,
  MarkNotificationReadInput,
  NotificationListInput,
  ArchiveNotificationInput,
} from "@/validations/notification.validation"

export function useNotifications(params: NotificationListInput | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.list(
      {
        organizationId: params?.organizationId,
        hostelId: params?.hostelId,
      },
      params ?? {}
    ),
    queryFn: () => notificationsSdk.list(params as NotificationListInput),
    enabled: Boolean(params?.organizationId),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      notificationId,
      input,
    }: {
      notificationId: string
      input: MarkNotificationReadInput
    }) => notificationsSdk.markRead(notificationId, input),
    onSuccess: (notification) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all({
          organizationId: notification.organization_id,
          hostelId: notification.hostel_id,
        }),
      })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MarkAllNotificationsReadInput) =>
      notificationsSdk.markAllRead(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useArchiveNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      notificationId,
      input,
    }: {
      notificationId: string
      input: ArchiveNotificationInput
    }) => notificationsSdk.archive(notificationId, input),
    onSuccess: (notification) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all({
          organizationId: notification.organization_id,
          hostelId: notification.hostel_id,
        }),
      })
    },
  })
}
