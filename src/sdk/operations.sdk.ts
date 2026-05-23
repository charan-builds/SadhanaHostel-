import { apiClient } from "@/lib/api-client"
import type {
  AutomationDashboard,
  AutomationRunResult,
  ConsistencyReport,
} from "@/types/operations"
import type {
  AutomationDashboardQueryInput,
  AutomationRunInput,
  AutomationSettingsInput,
  ConsistencyRepairInput,
  ConsistencyReportQueryInput,
} from "@/validations/operations.validation"

export const operationsSdk = {
  automationDashboard(params: AutomationDashboardQueryInput) {
    return apiClient.get<AutomationDashboard>("/api/operations/automation", params)
  },

  runAutomation(input: AutomationRunInput) {
    return apiClient.post<AutomationRunResult, AutomationRunInput>(
      "/api/operations/automation/run",
      input,
      { retry: 0 }
    )
  },

  updateAutomationSettings(input: AutomationSettingsInput) {
    return apiClient.patch<Record<string, unknown>, AutomationSettingsInput>(
      "/api/operations/automation/settings",
      input,
      { retry: 0 }
    )
  },

  consistencyReport(params: ConsistencyReportQueryInput) {
    return apiClient.get<ConsistencyReport>(
      "/api/operations/consistency/report",
      params
    )
  },

  repairConsistency(input: ConsistencyRepairInput) {
    return apiClient.post<
      { repaired: number; dryRun: boolean; message: string; report?: ConsistencyReport },
      ConsistencyRepairInput
    >("/api/operations/consistency/repair", input, { retry: 0 })
  },
}
