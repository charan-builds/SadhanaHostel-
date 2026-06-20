import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  ResidentCreateResult,
  ResidentLifecycleRepairResult,
  ResidentPasswordResetResult,
} from "@/types/residents"
import type { ResidentLifecycleControlCenter } from "@/types/resident-lifecycle"
import type {
  CheckoutResidentInput,
  CreateResidentInput,
  RepairResidentLifecycleInput,
  ResidentLifecycleControlCenterInput,
  ResidentIdMutationInput,
  ResidentListInput,
  UpdateOwnResidentProfileInput,
  UpdateResidentInput,
} from "@/validations/resident.validation"

import type { PaginatedResult } from "./types"

export const residentsSdk = {
  list(params: ResidentListInput) {
    return apiClient.get<PaginatedResult<Tables<"residents">>>(
      "/api/residents",
      params
    )
  },

  lifecycleControlCenter(params: ResidentLifecycleControlCenterInput) {
    return apiClient.get<ResidentLifecycleControlCenter>(
      "/api/residents/lifecycle-control-center",
      params
    )
  },

  get(residentId: string, organizationId: string) {
    return apiClient.get<Tables<"residents">>(`/api/residents/${residentId}`, {
      organizationId,
    })
  },

  me(organizationId: string) {
    return apiClient.get<Tables<"residents">>("/api/residents/me", {
      organizationId,
    })
  },

  create(input: CreateResidentInput) {
    return apiClient.post<ResidentCreateResult, CreateResidentInput>(
      "/api/residents",
      input
    )
  },

  update(input: UpdateResidentInput) {
    const { residentId, ...body } = input

    return apiClient.patch<Tables<"residents">, Omit<UpdateResidentInput, "residentId">>(
      `/api/residents/${residentId}`,
      body
    )
  },

  updateMe(input: UpdateOwnResidentProfileInput) {
    return apiClient.patch<Tables<"residents">, UpdateOwnResidentProfileInput>(
      "/api/residents/me",
      input
    )
  },

  deactivate(input: ResidentIdMutationInput) {
    return apiClient.delete<Tables<"residents">>(`/api/residents/${input.residentId}`, {
      organizationId: input.organizationId,
    })
  },

  purge(input: ResidentIdMutationInput) {
    return apiClient.delete<Tables<"residents">>(
      `/api/residents/${input.residentId}/purge`,
      { organizationId: input.organizationId }
    )
  },

  checkout(input: CheckoutResidentInput) {
    const { residentId, ...body } = input

    return apiClient.post<Tables<"residents">, Omit<CheckoutResidentInput, "residentId">>(
      `/api/residents/${residentId}/checkout`,
      body
    )
  },

  repairLifecycle(input: RepairResidentLifecycleInput) {
    const { residentId, ...body } = input

    return apiClient.post<
      ResidentLifecycleRepairResult,
      Omit<RepairResidentLifecycleInput, "residentId">
    >(
      `/api/residents/${residentId}/repair`,
      body
    )
  },

  resetPassword(input: ResidentIdMutationInput) {
    const { residentId, ...body } = input

    return apiClient.post<
      ResidentPasswordResetResult,
      Omit<ResidentIdMutationInput, "residentId">
    >(`/api/residents/${residentId}/reset-password`, body)
  },
}
