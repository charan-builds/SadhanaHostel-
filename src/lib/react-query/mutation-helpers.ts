"use client"

import type { QueryClient, QueryKey } from "@tanstack/react-query"

import { isTenantQueryKey } from "./query-keys"

export function invalidateTenantQueries(
  queryClient: QueryClient,
  organizationId: string
) {
  return queryClient.invalidateQueries({
    predicate: (query) => isTenantQueryKey(query.queryKey, organizationId),
  })
}

export function optimisticListUpdate<TItem extends { id: string }>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  item: TItem
) {
  queryClient.setQueryData<{
    data: TItem[]
    meta?: unknown
  }>(queryKey, (current) => {
    if (!current) {
      return current
    }

    return {
      ...current,
      data: current.data.map((entry) => (entry.id === item.id ? item : entry)),
    }
  })
}
