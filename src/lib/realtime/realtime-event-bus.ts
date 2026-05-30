"use client"

import type { RealtimeEventType } from "@/services/realtime/event-types"

import { getRealtimeChannelRegistry } from "./realtime-channel-registry"

export type RealtimeEventHandler = (payload: unknown) => void

type SubscriptionOptions = {
  channelName: string
  event: RealtimeEventType
  handler: RealtimeEventHandler
  throttleMs?: number
}

type HandlerEntry = {
  handler: RealtimeEventHandler
  throttleMs: number
  pendingPayload: unknown
  timer: ReturnType<typeof setTimeout> | null
}

type ChannelBusEntry = {
  release: () => void
  refCount: number
}

class RealtimeEventBus {
  private readonly channels = new Map<string, ChannelBusEntry>()
  private readonly handlers = new Map<string, Set<HandlerEntry>>()

  subscribe(options: SubscriptionOptions) {
    const key = buildHandlerKey(options.channelName, options.event)
    const entry: HandlerEntry = {
      handler: options.handler,
      throttleMs: options.throttleMs ?? 0,
      pendingPayload: null,
      timer: null,
    }

    this.acquireChannel(options.channelName)

    let handlers = this.handlers.get(key)

    if (!handlers) {
      handlers = new Set()
      this.handlers.set(key, handlers)
    }

    handlers.add(entry)

    return () => {
      if (entry.timer) {
        clearTimeout(entry.timer)
      }

      handlers.delete(entry)

      if (handlers.size === 0) {
        this.handlers.delete(key)
      }

      this.releaseChannel(options.channelName)
    }
  }

  snapshot() {
    return {
      channels: [...this.channels.entries()].map(([channelName, entry]) => ({
        channelName,
        refCount: entry.refCount,
      })),
      subscriptions: [...this.handlers.entries()].map(([key, handlers]) => ({
        key,
        handlers: handlers.size,
      })),
      registry: getRealtimeChannelRegistry().snapshot(),
    }
  }

  private acquireChannel(channelName: string) {
    const existing = this.channels.get(channelName)

    if (existing) {
      existing.refCount += 1
      return
    }

    const release = getRealtimeChannelRegistry().subscribe(channelName, (message) => {
      this.dispatch(channelName, message.event, message.payload)
    })

    this.channels.set(channelName, {
      release,
      refCount: 1,
    })
  }

  private releaseChannel(channelName: string) {
    const entry = this.channels.get(channelName)

    if (!entry) {
      return
    }

    entry.refCount -= 1

    if (entry.refCount > 0) {
      return
    }

    this.channels.delete(channelName)
    entry.release()
  }

  private dispatch(channelName: string, event: string, payload: unknown) {
    const handlers = this.handlers.get(buildHandlerKey(channelName, event as RealtimeEventType))

    if (!handlers) {
      return
    }

    for (const entry of handlers) {
      this.dispatchToHandler(entry, payload)
    }
  }

  private dispatchToHandler(entry: HandlerEntry, payload: unknown) {
    if (entry.throttleMs <= 0) {
      entry.handler(payload)
      return
    }

    entry.pendingPayload = payload

    if (entry.timer) {
      return
    }

    entry.timer = setTimeout(() => {
      entry.timer = null
      entry.handler(entry.pendingPayload)
      entry.pendingPayload = null
    }, entry.throttleMs)
  }
}

let bus: RealtimeEventBus | null = null

export function getRealtimeEventBus() {
  bus ??= new RealtimeEventBus()

  if (typeof window !== "undefined") {
    Object.assign(window, {
      __SADHANA_REALTIME_BUS__: () => bus?.snapshot(),
    })
  }

  return bus
}

function buildHandlerKey(channelName: string, event: RealtimeEventType) {
  return `${channelName}\u001f${event}`
}
