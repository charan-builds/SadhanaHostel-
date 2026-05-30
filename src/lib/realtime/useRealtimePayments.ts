"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import type { RealtimeEventType } from "@/services/realtime/event-types"

import { scheduleRealtimeInvalidations } from "./realtime-invalidation"
import { buildResidentChannelName, useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

const PAYMENTS_REALTIME_EVENTS = [
  "payment.status_changed",
] as const

const PAYMENT_SETTINGS_REALTIME_EVENTS = [
  "payment.settings_changed",
] as const

export function useRealtimePayments(options?: { enabled?: boolean; residentId?: string | null }) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const residentChannelName = organizationId && defaultHostelId && options?.residentId
    ? buildResidentChannelName(organizationId, defaultHostelId, options.residentId)
    : null
  const onEvent = useCallback((payload: unknown) => {
    if (!organizationId) {
      return
    }

    scheduleRealtimeInvalidations(
      queryClient,
      getPaymentInvalidationKeys({
        event: getRealtimeEventType(payload),
        organizationId,
        hostelId: defaultHostelId,
        fallbackResidentId: options?.residentId ?? null,
        payload,
      })
    )
  }, [defaultHostelId, options?.residentId, organizationId, queryClient])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    channelName: residentChannelName,
    event: PAYMENTS_REALTIME_EVENTS,
    enabled: options?.enabled,
    onEvent,
  })
  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    event: PAYMENT_SETTINGS_REALTIME_EVENTS,
    enabled: options?.enabled && !options?.residentId,
    onEvent,
  })
}

function getPaymentInvalidationKeys(input: {
  event: RealtimeEventType | null
  organizationId: string
  hostelId: string | null
  fallbackResidentId: string | null
  payload: unknown
}) {
  const scope = {
    organizationId: input.organizationId,
    hostelId: input.hostelId,
  }
  const paymentId = getPayloadString(input.payload, "paymentId")
  const residentId = getPayloadString(input.payload, "residentId") ?? input.fallbackResidentId

  if (input.event === "payment.settings_changed") {
    return [
      queryKeys.payments.settings(scope),
      queryKeys.payments.settingsHistory(scope),
    ]
  }

  if (residentId && input.fallbackResidentId) {
    return [
      queryKeys.payments.ledger({ organizationId: input.organizationId }, residentId),
      ...(paymentId ? [queryKeys.payments.detail(scope, paymentId)] : []),
    ]
  }

  return [
    queryKeys.payments.all(scope),
    queryKeys.analytics.dashboard(scope),
    ...(paymentId ? [queryKeys.payments.detail(scope, paymentId)] : []),
  ]
}

function getRealtimeEventType(payload: unknown): RealtimeEventType | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const type = (payload as { type?: unknown }).type
  return typeof type === "string" ? (type as RealtimeEventType) : null
}

function getPayloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const nested = (payload as { payload?: unknown }).payload
  const value = nested && typeof nested === "object"
    ? (nested as Record<string, unknown>)[key]
    : (payload as Record<string, unknown>)[key]

  return typeof value === "string" ? value : null
}
