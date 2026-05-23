"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { launchSdk, type LaunchDiagnosticsInput } from "@/sdk"

export function useLaunchDiagnostics(params: LaunchDiagnosticsInput) {
  return useQuery({
    queryKey: queryKeys.launch.diagnostics(params),
    queryFn: () => launchSdk.diagnostics(params),
    enabled: Boolean(params.organizationId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useLaunchMetrics(params: LaunchDiagnosticsInput) {
  return useQuery({
    queryKey: queryKeys.launch.metrics(params),
    queryFn: () => launchSdk.metrics(params),
    enabled: Boolean(params.organizationId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
