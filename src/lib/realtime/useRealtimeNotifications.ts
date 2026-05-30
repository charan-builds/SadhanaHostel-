"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { scheduleRealtimeInvalidations } from "./realtime-invalidation"
import { buildResidentChannelName, useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

export function useRealtimeNotifications(options?: { enabled?: boolean; residentId?: string | null }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const residentChannelName = organizationId && defaultHostelId && options?.residentId
    ? buildResidentChannelName(organizationId, defaultHostelId, options.residentId)
    : null
  const onEvent = useCallback(() => {
    if (!organizationId) {
      return
    }

    scheduleRealtimeInvalidations(queryClient, [
      queryKeys.notices.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    ])
  }, [defaultHostelId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    channelName: residentChannelName,
    event: "notification.created",
    enabled: options?.enabled && Boolean(options?.residentId),
    onEvent,
  })
}
