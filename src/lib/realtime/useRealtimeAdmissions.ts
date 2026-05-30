"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import type { RealtimeEventType } from "@/services/realtime/event-types"

import { scheduleRealtimeInvalidations } from "./realtime-invalidation"
import { useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

const ADMISSIONS_REALTIME_EVENTS = [
  "vacancy.changed",
  "dashboard.refresh",
  "lead.created",
  "lead.updated",
  "reservation.created",
  "reservation.confirmed",
  "reservation.expired",
  "reservation.converted",
  "room.allocation_changed",
  "room.transfer_completed",
  "resident.created",
  "resident.updated",
  "resident.deactivated",
  "resident.checked_out",
  "resident.invite_created",
  "resident.invite_resent",
  "resident.invite_revoked",
  "resident.invite_used",
] as const

export function useRealtimeAdmissions(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const onEvent = useCallback((payload: unknown) => {
    if (!organizationId) {
      return
    }

    scheduleRealtimeInvalidations(
      queryClient,
      getAdmissionsInvalidationKeys({
        event: getRealtimeEventType(payload),
        organizationId,
        hostelId: defaultHostelId,
      })
    )
  }, [defaultHostelId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: ADMISSIONS_REALTIME_EVENTS,
    enabled: options?.enabled,
    onEvent,
  })
}

function getAdmissionsInvalidationKeys(input: {
  event: RealtimeEventType | null
  organizationId: string
  hostelId: string | null
}) {
  const scope = {
    organizationId: input.organizationId,
    hostelId: input.hostelId,
  }

  switch (input.event) {
    case "lead.created":
    case "lead.updated":
      return [queryKeys.admissions.all(scope)]
    case "reservation.created":
    case "reservation.confirmed":
    case "reservation.expired":
    case "reservation.converted":
      return [
        queryKeys.admissions.all(scope),
        queryKeys.analytics.dashboard(scope),
      ]
    case "vacancy.changed":
      return [
        queryKeys.admissions.vacancy(scope),
        queryKeys.rooms.all(scope),
        queryKeys.analytics.dashboard(scope),
      ]
    case "room.allocation_changed":
    case "room.transfer_completed":
      return [
        queryKeys.rooms.all(scope),
        queryKeys.residents.all(scope),
        queryKeys.analytics.dashboard(scope),
      ]
    case "resident.created":
    case "resident.updated":
    case "resident.deactivated":
    case "resident.checked_out":
      return [
        queryKeys.residents.all(scope),
        queryKeys.rooms.all(scope),
        queryKeys.analytics.dashboard(scope),
      ]
    case "resident.invite_created":
    case "resident.invite_resent":
    case "resident.invite_revoked":
    case "resident.invite_used":
      return [
        queryKeys.invites.all(scope),
        queryKeys.residents.all(scope),
      ]
    case "dashboard.refresh":
      return [queryKeys.analytics.dashboard(scope)]
    default:
      return [queryKeys.admissions.all(scope)]
  }
}

function getRealtimeEventType(payload: unknown): RealtimeEventType | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const type = (payload as { type?: unknown }).type
  return typeof type === "string" ? (type as RealtimeEventType) : null
}
