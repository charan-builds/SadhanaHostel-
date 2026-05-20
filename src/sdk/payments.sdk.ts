import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  CreatePaymentInput,
  PaymentListInput,
  VerifyPaymentInput,
} from "@/validations/payment.validation"

import type { PaginatedResult } from "./types"

export const paymentsSdk = {
  list(params: PaymentListInput) {
    return apiClient.get<PaginatedResult<Tables<"payments">>>(
      "/api/payments",
      params
    )
  },

  get(paymentId: string, organizationId: string) {
    return apiClient.get<Tables<"payments">>(`/api/payments/${paymentId}`, {
      organizationId,
    })
  },

  listResidentPayments(organizationId: string, residentId: string) {
    return apiClient.get<PaginatedResult<Tables<"payments">>>(
      `/api/payments/resident/${residentId}`,
      { organizationId }
    )
  },

  createUpi(input: CreatePaymentInput) {
    return apiClient.post<Tables<"payments">, CreatePaymentInput>(
      "/api/payments/create",
      input,
      { retry: 0 }
    )
  },

  verify(input: VerifyPaymentInput) {
    return apiClient.post<Tables<"payments">, VerifyPaymentInput>(
      "/api/payments/verify",
      input,
      { retry: 0 }
    )
  },
}
