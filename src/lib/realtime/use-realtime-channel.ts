"use client"

import { useEffect, useMemo } from "react"
import * as Sentry from "@sentry/nextjs"

import type { RealtimeEventType } from "@/services/realtime/event-types"

import { buildTenantChannelName } from "./realtime-provider"
import { getRealtimeEventBus } from "./realtime-event-bus"

type UseRealtimeChannelOptions = {
  organizationId: string | null
  hostelId?: string | null
  channelName?: string | null
  event: RealtimeEventType | readonly RealtimeEventType[]
  enabled?: boolean
  throttleMs?: number
  onEvent: (payload: unknown) => void
}

export function useRealtimeChannel(options: UseRealtimeChannelOptions) {
  const {
    organizationId,
    hostelId,
    channelName,
    event,
    enabled = true,
    throttleMs,
    onEvent,
  } = options
  const realtimeEvents = useMemo(() => normalizeRealtimeEvents(event), [event])
  const resolvedChannelName = channelName ?? (
    organizationId ? buildTenantChannelName(organizationId, hostelId) : null
  )

  useEffect(() => {
    if (!organizationId || !enabled || !resolvedChannelName) {
      return
    }

    const bus = getRealtimeEventBus()
    const releases = realtimeEvents.map((realtimeEvent) =>
      bus.subscribe({
        channelName: resolvedChannelName,
        event: realtimeEvent,
        throttleMs,
        handler: (payload) => {
          try {
            onEvent(payload)
          } catch (error) {
            Sentry.captureException(error, {
              tags: {
                realtime_event: realtimeEvent,
                realtime_channel: resolvedChannelName,
              },
            })
          }
        },
      })
    )

    return () => {
      for (const release of releases) {
        release()
      }
    }
  }, [enabled, onEvent, organizationId, realtimeEvents, resolvedChannelName, throttleMs])
}

export function normalizeRealtimeEvents(
  event: RealtimeEventType | readonly RealtimeEventType[]
) {
  return Array.isArray(event) ? [...new Set(event)] : [event]
}

export function buildRealtimeEventsDependencyKey(
  event: RealtimeEventType | readonly RealtimeEventType[]
) {
  return normalizeRealtimeEvents(event).join("\u001f")
}
