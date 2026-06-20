"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"

import { scheduleRealtimeInvalidations } from "./realtime-invalidation"
import { buildResidentChannelName, useRealtimeContext } from "./realtime-provider"
import { useRealtimeChannel } from "./use-realtime-channel"

export function useRealtimeResidentFinance(options: {
  enabled?: boolean
  residentId?: string | null
}) {
  const queryClient = useQueryClient()
  const { organizationId, defaultHostelId } = useRealtimeContext()
  const residentId = options.residentId ?? null
  const channelName =
    organizationId && defaultHostelId && residentId
      ? buildResidentChannelName(organizationId, defaultHostelId, residentId)
      : null
  const onEvent = useCallback(() => {
    if (!organizationId || !residentId) {
      return
    }

    scheduleRealtimeInvalidations(queryClient, [
      queryKeys.residents.detail({ organizationId }, "me"),
      queryKeys.residents.detail(
        { organizationId, hostelId: defaultHostelId },
        "me"
      ),
      queryKeys.finance.advanceLedger(
        { organizationId, hostelId: defaultHostelId },
        residentId
      ),
      queryKeys.finance.advanceLedger(
        { organizationId, hostelId: defaultHostelId },
        "self"
      ),
      queryKeys.payments.ledger({ organizationId }, residentId),
    ])
  }, [defaultHostelId, organizationId, queryClient, residentId])

  useRealtimeChannel({
    organizationId,
    hostelId: defaultHostelId,
    channelName,
    event: "resident.financial_corrected",
    enabled: options.enabled && Boolean(residentId),
    onEvent,
  })
}
