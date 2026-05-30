"use client"

import * as Sentry from "@sentry/nextjs"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { getCurrentAccessToken } from "@/lib/api-client/auth-token"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type BroadcastMessage = {
  event: string
  payload: unknown
}

type ChannelHandler = (message: BroadcastMessage) => void

type ChannelEntry = {
  channel: RealtimeChannel
  handlers: Set<ChannelHandler>
  refCount: number
}

class RealtimeChannelRegistry {
  private readonly channels = new Map<string, ChannelEntry>()

  subscribe(channelName: string, handler: ChannelHandler) {
    let entry = this.channels.get(channelName)

    if (!entry) {
      entry = this.createEntry(channelName)
      this.channels.set(channelName, entry)
    }

    entry.refCount += 1
    entry.handlers.add(handler)

    return () => {
      this.release(channelName, handler)
    }
  }

  snapshot() {
    return [...this.channels.entries()].map(([channelName, entry]) => ({
      channelName,
      refCount: entry.refCount,
      handlers: entry.handlers.size,
    }))
  }

  private createEntry(channelName: string): ChannelEntry {
    const supabase = createSupabaseBrowserClient()
    const handlers = new Set<ChannelHandler>()
    const channel = supabase.channel(channelName, {
      config: {
        private: true,
      },
    })

    void setRealtimeAuthFromCurrentSession(supabase)
      .then(() => {
        channel
          .on("broadcast", { event: "*" }, (message) => {
            const broadcast = toBroadcastMessage(message)

            if (!broadcast) {
              return
            }

            for (const handler of handlers) {
              handler(broadcast)
            }
          })
          .subscribe((status, error) => {
            if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT") {
              return
            }

            void setRealtimeAuthFromCurrentSession(supabase)
            Sentry.captureMessage("Realtime registry channel subscription failed.", {
              level: "warning",
              tags: {
                realtime_channel: channelName,
                realtime_status: status,
              },
              extra: {
                error,
              },
            })
          })
      })
      .catch((error) => {
        Sentry.captureException(error, {
          tags: {
            realtime_channel: channelName,
            realtime_stage: "registry_subscribe",
          },
        })
      })

    return {
      channel,
      handlers,
      refCount: 0,
    }
  }

  private release(channelName: string, handler: ChannelHandler) {
    const entry = this.channels.get(channelName)

    if (!entry) {
      return
    }

    entry.handlers.delete(handler)
    entry.refCount -= 1

    if (entry.refCount > 0) {
      return
    }

    this.channels.delete(channelName)
    void createSupabaseBrowserClient().removeChannel(entry.channel)
  }
}

let registry: RealtimeChannelRegistry | null = null

export function getRealtimeChannelRegistry() {
  registry ??= new RealtimeChannelRegistry()
  return registry
}

async function setRealtimeAuthFromCurrentSession(
  supabase: ReturnType<typeof createSupabaseBrowserClient>
) {
  const accessToken = await getCurrentAccessToken()

  if (accessToken) {
    supabase.realtime.setAuth(accessToken)
  }
}

function toBroadcastMessage(message: unknown): BroadcastMessage | null {
  if (!message || typeof message !== "object") {
    return null
  }

  const record = message as { event?: unknown; payload?: unknown }

  if (typeof record.event !== "string") {
    return null
  }

  return {
    event: record.event,
    payload: record.payload,
  }
}
