"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { analyticsSdk, type AdvancedAnalyticsInput, type DashboardAnalyticsInput } from "@/sdk"

export function useDashboardAnalytics(params: DashboardAnalyticsInput) {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(params),
    queryFn: () => analyticsSdk.dashboard(params),
    enabled: Boolean(params.organizationId),
    staleTime: 30_000,
  })
}

export function useAdvancedAnalytics(params: AdvancedAnalyticsInput) {
  return useQuery({
    queryKey: queryKeys.analytics.advanced(params, params),
    queryFn: () => analyticsSdk.advanced(params),
    enabled: Boolean(params.organizationId),
    staleTime: 5 * 60_000,
  })
}
