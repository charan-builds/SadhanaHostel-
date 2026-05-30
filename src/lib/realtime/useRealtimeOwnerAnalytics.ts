"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { scheduleRealtimeInvalidations } from "./realtime-invalidation"
import { useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

const OWNER_ANALYTICS_REALTIME_EVENTS = [
  "vacancy.changed",
  "reservation.created",
  "reservation.confirmed",
  "reservation.expired",
  "reservation.converted",
  "payment.status_changed",
  "room.allocation_changed",
] as const

export function useRealtimeOwnerAnalytics(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const onEvent = useCallback(() => {
    if (!organizationId) {
      return
    }

    scheduleRealtimeInvalidations(queryClient, [
      queryKeys.analytics.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    ])
  }, [defaultHostelId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: OWNER_ANALYTICS_REALTIME_EVENTS,
    enabled: options?.enabled,
    onEvent,
  })
}
