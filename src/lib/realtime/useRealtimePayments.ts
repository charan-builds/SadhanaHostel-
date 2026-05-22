"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

export function useRealtimePayments(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const onEvent = useCallback(() => {
    if (!organizationId) {
      return
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.payments.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.analytics.dashboard({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
  }, [defaultHostelId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "payment.status_changed",
    enabled: options?.enabled,
    onEvent,
  })

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "payment.settings_changed",
    enabled: options?.enabled,
    onEvent,
  })
}
