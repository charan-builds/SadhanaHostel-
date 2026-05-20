"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

export function useRealtimeNotifications(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const onEvent = useCallback(() => {
    if (!organizationId) {
      return
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.notices.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
  }, [defaultHostelId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    event: "notification.created",
    enabled: options?.enabled,
    onEvent,
  })
}
