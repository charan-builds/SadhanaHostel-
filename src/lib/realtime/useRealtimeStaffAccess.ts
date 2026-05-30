"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { scheduleRealtimeInvalidations } from "./realtime-invalidation"
import { useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

const STAFF_ACCESS_REALTIME_EVENTS = [
  "staff.created",
  "staff.role_changed",
  "staff.access_revoked",
  "staff.password_reset",
] as const

export function useRealtimeStaffAccess(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const { organizationId } = useRealtimeContext()
  const onEvent = useCallback(() => {
    if (!organizationId) {
      return
    }

    scheduleRealtimeInvalidations(queryClient, [
      queryKeys.staffAccess.all({ organizationId }),
      queryKeys.auth.session,
    ])
  }, [organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: null,
    event: STAFF_ACCESS_REALTIME_EVENTS,
    enabled: options?.enabled,
    onEvent,
  })
}
