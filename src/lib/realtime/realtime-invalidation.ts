"use client"

import type { QueryClient, QueryKey } from "@tanstack/react-query"

const DEFAULT_REALTIME_INVALIDATION_DELAY_MS = 500

const pendingByClient = new WeakMap<
  QueryClient,
  {
    keys: Map<string, QueryKey>
    timer: ReturnType<typeof setTimeout> | null
  }
>()

export function scheduleRealtimeInvalidations(
  queryClient: QueryClient,
  queryKeys: QueryKey[],
  delayMs = DEFAULT_REALTIME_INVALIDATION_DELAY_MS
) {
  let pending = pendingByClient.get(queryClient)

  if (!pending) {
    pending = {
      keys: new Map(),
      timer: null,
    }
    pendingByClient.set(queryClient, pending)
  }

  for (const queryKey of queryKeys) {
    pending.keys.set(JSON.stringify(queryKey), queryKey)
  }

  if (pending.timer) {
    return
  }

  pending.timer = setTimeout(() => {
    const keys = [...pending.keys.values()]

    pending.keys.clear()
    pending.timer = null

    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }, delayMs)
}
