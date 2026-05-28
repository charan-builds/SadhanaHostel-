import { apiClient } from "@/lib/api-client"
import type {
  AutomationDashboard,
  AutomationRunResult,
  ConsistencyReport,
  DemoDataResetReport,
  IdentityReconciliationReport,
  IdentityRepairResult,
} from "@/types/operations"
import type {
  AutomationDashboardQueryInput,
  AutomationRunInput,
  AutomationSettingsInput,
  ConsistencyRepairInput,
  ConsistencyReportQueryInput,
  DemoDataResetInput,
  IdentityReconciliationQueryInput,
  IdentityRepairInput,
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

  resetDemoData(input: DemoDataResetInput) {
    return apiClient.post<DemoDataResetReport, DemoDataResetInput>(
      "/api/operations/demo-data-reset",
      input,
      { retry: 0 }
    )
  },

  identityReconciliation(params: IdentityReconciliationQueryInput) {
    return apiClient.get<IdentityReconciliationReport>(
      "/api/operations/identity-repair",
      params
    )
  },

  repairIdentities(input: IdentityRepairInput) {
    return apiClient.post<IdentityRepairResult, IdentityRepairInput>(
      "/api/operations/identity-repair",
      input,
      { retry: 0 }
    )
  },
}
