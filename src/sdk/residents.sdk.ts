import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  CreateResidentInput,
  ResidentIdMutationInput,
  ResidentListInput,
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

  get(residentId: string, organizationId: string) {
    return apiClient.get<Tables<"residents">>(`/api/residents/${residentId}`, {
      organizationId,
    })
  },

  create(input: CreateResidentInput) {
    return apiClient.post<Tables<"residents">, CreateResidentInput>(
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

  deactivate(input: ResidentIdMutationInput) {
    return apiClient.delete<Tables<"residents">>(`/api/residents/${input.residentId}`, {
      organizationId: input.organizationId,
    })
  },
}
