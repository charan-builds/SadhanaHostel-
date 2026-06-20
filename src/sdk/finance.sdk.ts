import { apiClient } from "@/lib/api-client"
import type { FinanceDashboard } from "@/lib/finance/finance-dashboard"
import type { CollectionFollowupRow } from "@/repositories/collection-followups.repository"
import type {
  AdvanceLedgerSummary,
  AdvanceOwnerDashboard,
  AdvancePaymentDepositRow,
  AdvancePaymentRefundRow,
  AdvanceReports,
} from "@/types/advance-ledger"
import type {
  AdvanceAllocationRunInput,
  AdvanceDepositCreateInput,
  AdvanceLedgerQueryInput,
  AdvanceRefundApproveInput,
  AdvanceRefundCreateInput,
  AdvanceReportsInput,
  AdvanceSettlementInput,
  CollectionFollowupCompleteInput,
  CollectionFollowupCreateInput,
  CollectionFollowupListInput,
  FinanceAutomationRunInput,
  FinanceDashboardInput,
} from "@/validations/finance.validation"
import type { AutomationRunResult } from "@/types/operations"
import type {
  FinancialCorrectionInput,
  FinancialCorrectionResult,
} from "@/validations/financial-correction.validation"

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
  advanceLedger(params: AdvanceLedgerQueryInput) {
    return apiClient.get<AdvanceLedgerSummary>("/api/finance/advance-ledger", params)
  },
  recordAdvanceDeposit(input: AdvanceDepositCreateInput) {
    return apiClient.post<AdvancePaymentDepositRow, AdvanceDepositCreateInput>(
      "/api/finance/advance-ledger/deposits",
      input,
      { retry: 0 }
    )
  },
  allocateAdvance(input: AdvanceAllocationRunInput) {
    return apiClient.post<
      { processed: number; results: Array<Record<string, unknown>> },
      AdvanceAllocationRunInput
    >("/api/finance/advance-ledger/allocate", input, { retry: 0 })
  },
  requestAdvanceRefund(input: AdvanceRefundCreateInput) {
    return apiClient.post<AdvancePaymentRefundRow, AdvanceRefundCreateInput>(
      "/api/finance/advance-ledger/refunds",
      input,
      { retry: 0 }
    )
  },
  approveAdvanceRefund(input: AdvanceRefundApproveInput) {
    return apiClient.post<
      AdvancePaymentRefundRow,
      Omit<AdvanceRefundApproveInput, "refundId">
    >(
      `/api/finance/advance-ledger/refunds/${input.refundId}/approve`,
      {
        organizationId: input.organizationId,
        action: input.action,
        ...(input.notes ? { notes: input.notes } : {}),
      },
      { retry: 0 }
    )
  },
  advanceReports(params: AdvanceReportsInput) {
    return apiClient.get<{
      reports: AdvanceReports
      ownerDashboard: AdvanceOwnerDashboard
    }>("/api/finance/advance-ledger/reports", params)
  },
  advanceSettlement(params: AdvanceSettlementInput) {
    return apiClient.get<{
      resident: AdvanceLedgerSummary["resident"]
      totalAdvance: number
      consumed: number
      remaining: number
      refundable: number
      coveredUntil: string | null
      nextDueDate: string | null
      refunds: AdvancePaymentRefundRow[]
    }>("/api/finance/advance-ledger/settlement", params)
  },
  applyCorrection(input: FinancialCorrectionInput) {
    return apiClient.post<FinancialCorrectionResult, FinancialCorrectionInput>(
      "/api/finance/corrections",
      input,
      { retry: 0 }
    )
  },
}
