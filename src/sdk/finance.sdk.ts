import { apiClient } from "@/lib/api-client"
import type { FinanceDashboard } from "@/lib/finance/finance-dashboard"
import type { CollectionFollowupRow } from "@/repositories/collection-followups.repository"
import type {
  CollectionFollowupCompleteInput,
  CollectionFollowupCreateInput,
  CollectionFollowupListInput,
  FinanceAutomationRunInput,
  FinanceDashboardInput,
} from "@/validations/finance.validation"
import type { AutomationRunResult } from "@/types/operations"

export const financeSdk = {
  dashboard(params: FinanceDashboardInput) {
    return apiClient.get<FinanceDashboard>("/api/finance/dashboard", params)
  },
  runAutomation(input: FinanceAutomationRunInput) {
    return apiClient.post<AutomationRunResult, FinanceAutomationRunInput>(
      "/api/finance/automation/run",
      input,
      { retry: 0 }
    )
  },
  followups(params: CollectionFollowupListInput) {
    return apiClient.get<CollectionFollowupRow[]>("/api/finance/followups", params)
  },
  createFollowup(input: CollectionFollowupCreateInput) {
    return apiClient.post<CollectionFollowupRow, CollectionFollowupCreateInput>(
      "/api/finance/followups",
      input,
      { retry: 0 }
    )
  },
  completeFollowup(input: CollectionFollowupCompleteInput) {
    return apiClient.post<
      CollectionFollowupRow,
      Omit<CollectionFollowupCompleteInput, "followupId">
    >(
      `/api/finance/followups/${input.followupId}/complete`,
      {
        organizationId: input.organizationId,
        ...(input.note ? { note: input.note } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      },
      { retry: 0 }
    )
  },
}
