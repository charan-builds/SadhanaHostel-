"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { searchSdk, type SearchInput } from "@/sdk"

export function useSearch(params: SearchInput, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.search(params, params),
    queryFn: () => searchSdk.search(params),
    enabled:
      Boolean(params.organizationId && params.query.trim().length >= 2) &&
      (options?.enabled ?? true),
    staleTime: 15_000,
  })
}
