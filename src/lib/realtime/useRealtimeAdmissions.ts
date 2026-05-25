"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

export function useRealtimeAdmissions(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const onEvent = useCallback(() => {
    if (!organizationId) {
      return
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.admissions.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.residents.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rooms.all({
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
    void queryClient.invalidateQueries({
      queryKey: queryKeys.analytics.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.operations.all({
        organizationId,
        hostelId: defaultHostelId,
      }),
    })
  }, [defaultHostelId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "vacancy.changed",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "dashboard.refresh",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "lead.created",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "lead.updated",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "reservation.created",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "reservation.confirmed",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "reservation.expired",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "reservation.converted",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "room.allocation_changed",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "resident.created",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "resident.updated",
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: "resident.deactivated",
    enabled: options?.enabled,
    onEvent,
  })
}
