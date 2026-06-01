import { apiClient } from "@/lib/api-client"
import type {
  OperationalAlert,
  ResidentPasswordResetRequestResult,
  SupportPasswordResetApprovalResult,
  SupportRequestResult,
} from "@/types/support"
import type { Tables } from "@/types/database"
import type {
  OperationalAlertsQueryInput,
  ResidentPasswordResetRequestInput,
  SupportPasswordResetApprovalInput,
  SupportRequestCreateInput,
  SupportRequestListInput,
  SupportRequestUpdateInput,
} from "@/validations/support.validation"

import type { PaginatedResult } from "./types"

export const supportSdk = {
  listRequests(params: SupportRequestListInput) {
    return apiClient.get<PaginatedResult<Tables<"support_requests">>>(
      "/api/support/requests",
      params
    )
  },

  createRequest(input: SupportRequestCreateInput) {
    return apiClient.post<SupportRequestResult, SupportRequestCreateInput>(
      "/api/support/requests",
      input,
      { retry: 0 }
    )
  },

  createResidentPasswordResetRequest(input: ResidentPasswordResetRequestInput) {
    return apiClient.post<
      ResidentPasswordResetRequestResult,
      ResidentPasswordResetRequestInput
    >("/api/support/resident-password-reset", input, { retry: 0 })
  },

  updateRequest(input: SupportRequestUpdateInput) {
    const { requestId, ...body } = input

    return apiClient.patch<Tables<"support_requests">, Omit<SupportRequestUpdateInput, "requestId">>(
      `/api/support/requests/${requestId}`,
      body,
      { retry: 0 }
    )
  },

  approveResidentPasswordResetRequest(input: SupportPasswordResetApprovalInput) {
    const { requestId, ...body } = input

    return apiClient.post<
      SupportPasswordResetApprovalResult,
      Omit<SupportPasswordResetApprovalInput, "requestId">
    >(`/api/support/requests/${requestId}/resident-password-reset`, body, { retry: 0 })
  },

  operationalAlerts(params: OperationalAlertsQueryInput) {
    return apiClient.get<OperationalAlert[]>("/api/support/alerts", params)
  },
}
