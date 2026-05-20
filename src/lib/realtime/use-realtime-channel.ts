"use client"

import { useEffect } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"

import { buildTenantChannelName } from "./realtime-provider"

type UseRealtimeChannelOptions = {
  organizationId: string | null
  hostelId?: string | null
  event: string
  enabled?: boolean
  onEvent: (payload: unknown) => void
}

export function useRealtimeChannel(options: UseRealtimeChannelOptions) {
  const {
    organizationId,
    hostelId,
    event,
    enabled = true,
    onEvent,
  } = options

  useEffect(() => {
    if (!organizationId || !enabled) {
      return
    }

    const supabase = createSupabaseBrowserClient()
    const channelName = buildTenantChannelName(organizationId, hostelId)
    let channel: RealtimeChannel | null = supabase.channel(channelName, {
      config: {
        private: true,
      },
    })

    channel
      .on("broadcast", { event }, (payload) => {
        onEvent(payload.payload)
      })
      .subscribe()

    return () => {
      if (channel) {
        void supabase.removeChannel(channel)
        channel = null
      }
    }
  }, [enabled, event, hostelId, onEvent, organizationId])
}
