import { apiClient } from "@/lib/api-client"
import type { LaunchDiagnostics } from "@/types/launch"

export type LaunchDiagnosticsInput = {
  organizationId?: string | null
  hostelId?: string | null
}

export type LaunchMetrics = Pick<
  LaunchDiagnostics,
  "generatedAt" | "organizationId" | "hostelId" | "metrics"
>

export const launchSdk = {
  diagnostics(params: LaunchDiagnosticsInput) {
    return apiClient.get<LaunchDiagnostics>("/api/launch/diagnostics", params)
  },

  metrics(params: LaunchDiagnosticsInput) {
    return apiClient.get<LaunchMetrics>("/api/launch/metrics", params)
  },
}
