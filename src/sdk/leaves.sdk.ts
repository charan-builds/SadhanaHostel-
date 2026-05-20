import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  CreateLeaveRequestInput,
  LeaveListInput,
  ReviewLeaveRequestInput,
} from "@/validations/leave.validation"

import type { PaginatedResult } from "./types"

export const leavesSdk = {
  list(params: LeaveListInput) {
    return apiClient.get<PaginatedResult<Tables<"leave_requests">>>(
      "/api/leaves",
      params
    )
  },

  create(input: CreateLeaveRequestInput) {
    return apiClient.post<Tables<"leave_requests">, CreateLeaveRequestInput>(
      "/api/leaves",
      input
    )
  },

  approve(input: Omit<ReviewLeaveRequestInput, "status">) {
    const { leaveRequestId, ...body } = input

    return apiClient.patch<Tables<"leave_requests">, typeof body>(
      `/api/leaves/${leaveRequestId}/approve`,
      body
    )
  },

  reject(input: Omit<ReviewLeaveRequestInput, "status">) {
    const { leaveRequestId, ...body } = input

    return apiClient.patch<Tables<"leave_requests">, typeof body>(
      `/api/leaves/${leaveRequestId}/reject`,
      body
    )
  },
}
