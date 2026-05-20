"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

export function useRealtimeLeaves(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const onEvent = useCallback(() => {
    if (!organizationId) {
      return
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.leaves.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
  }, [defaultHostelId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    event: "leave.status_changed",
    enabled: options?.enabled,
    onEvent,
  })
}
