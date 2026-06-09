"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { searchSdk, type SearchInput } from "@/sdk"

export function useSearch(params: SearchInput | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: params
      ? queryKeys.search(params, params)
      : queryKeys.search({}, { query: "", disabled: true }),
    queryFn: () => searchSdk.search(params as SearchInput),
    enabled:
      Boolean(params?.organizationId && params.query.trim().length >= 2) &&
      (options?.enabled ?? true),
    staleTime: 15_000,
  })
}
