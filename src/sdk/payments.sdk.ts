import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  PaymentQrUploadResult,
  PaymentSettingView,
  PaymentSettingTestResult,
  ResidentPaymentLedger,
} from "@/types/payment-operations"
import type {
  CreatePaymentInput,
  PaymentListInput,
  PaymentQrUploadInput,
  PaymentSettingsInput,
  PaymentSettingsHistoryInput,
  PaymentSettingsQueryInput,
  PaymentSettingsTestInput,
  RejectPaymentInput,
  ResidentPaymentLedgerInput,
  SubmitUpiPaymentInput,
  VerifyPaymentInput,
} from "@/validations/payment.validation"

import type { PaginatedResult } from "./types"
import { uploadFile, type UploadOptions } from "./uploads.sdk"

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

  submitUpiWithProof(
    input: SubmitUpiPaymentInput,
    proofFile: File,
    options?: UploadOptions
  ) {
    return uploadFile<Tables<"payments">>(
      "/api/payments/submit-upi",
      input,
      proofFile,
      options
    )
  },

  verify(input: VerifyPaymentInput) {
    return apiClient.post<Tables<"payments">, VerifyPaymentInput>(
      "/api/payments/verify",
      input,
      { retry: 0 }
    )
  },

  reject(input: RejectPaymentInput) {
    return apiClient.post<Tables<"payments">, RejectPaymentInput>(
      "/api/payments/reject",
      input,
      { retry: 0 }
    )
  },

  getSettings(params: PaymentSettingsQueryInput) {
    return apiClient.get<PaymentSettingView | null>("/api/payments/settings", params)
  },

  listSettingsHistory(params: PaymentSettingsHistoryInput) {
    return apiClient.get<PaymentSettingView[]>(
      "/api/payments/settings/history",
      params
    )
  },

  saveSettings(input: PaymentSettingsInput) {
    return apiClient.patch<PaymentSettingView, PaymentSettingsInput>(
      "/api/payments/settings",
      input,
      { retry: 0 }
    )
  },

  testSettings(input: PaymentSettingsTestInput) {
    return apiClient.post<PaymentSettingTestResult, PaymentSettingsTestInput>(
      "/api/payments/settings/test",
      input,
      { retry: 0 }
    )
  },

  uploadQr(input: PaymentQrUploadInput, file: File, options?: UploadOptions) {
    return uploadFile<PaymentQrUploadResult>(
      "/api/payments/settings/qr",
      input,
      file,
      options
    )
  },

  getLedger(params: ResidentPaymentLedgerInput) {
    return apiClient.get<ResidentPaymentLedger>("/api/payments/ledger", params)
  },
}
