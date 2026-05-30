"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { scheduleRealtimeInvalidations } from "./realtime-invalidation"
import { buildResidentChannelName, useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

export function useRealtimeLeaves(options?: { enabled?: boolean; residentId?: string | null }) {
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
      queryKeys.leaves.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
      ...(options?.residentId
        ? []
        : [queryKeys.analytics.dashboard({
        organizationId,
        hostelId: defaultHostelId,
      })]),
    ])
  }, [defaultHostelId, options?.residentId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    channelName: residentChannelName,
    event: "leave.status_changed",
    enabled: options?.enabled,
    onEvent,
  })
}
