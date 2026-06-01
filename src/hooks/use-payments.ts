"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { paymentsSdk } from "@/sdk"
import type {
  CreatePaymentInput,
  PaymentListInput,
  PaymentQrUploadInput,
  PaymentSettingsInput,
  PaymentSettingsHistoryInput,
  PaymentSettingsQueryInput,
  PaymentSettingsTestInput,
  RecordInPersonPaymentInput,
  RejectPaymentInput,
  ResidentPaymentLedgerInput,
  SubmitUpiPaymentInput,
  VerifyPaymentInput,
} from "@/validations/payment.validation"
import type { UploadOptions } from "@/sdk"

export function usePayments(params: PaymentListInput) {
  return useQuery({
    queryKey: queryKeys.payments.list(params, params),
    queryFn: () => paymentsSdk.list(params),
    enabled: Boolean(params.organizationId),
  })
}

export function usePayment(paymentId: string | undefined, organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.detail({ organizationId }, paymentId ?? "new"),
    queryFn: () => paymentsSdk.get(String(paymentId), String(organizationId)),
    enabled: Boolean(paymentId && organizationId),
  })
}

export function useCreateUpiPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePaymentInput) => paymentsSdk.createUpi(input),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
    },
  })
}

export function useRecordInPersonPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RecordInPersonPaymentInput) =>
      paymentsSdk.recordInPerson(input),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.ledger(
          {
            organizationId: payment.organization_id,
          },
          payment.resident_id
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.analytics.dashboard({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
    },
  })
}

export function useSubmitUpiPaymentWithProof(options?: UploadOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      input,
      file,
    }: {
      input: SubmitUpiPaymentInput
      file: File
    }) => paymentsSdk.submitUpiWithProof(input, file, options),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.analytics.dashboard({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
    },
  })
}

export function useVerifyPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: VerifyPaymentInput) => paymentsSdk.verify(input),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.analytics.dashboard({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
    },
  })
}

export function useRejectPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RejectPaymentInput) => paymentsSdk.reject(input),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all({
          organizationId: payment.organization_id,
          hostelId: payment.hostel_id,
        }),
      })
    },
  })
}

export function usePaymentSettings(params: PaymentSettingsQueryInput | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.settings({
      organizationId: params?.organizationId,
      hostelId: params?.hostelId,
    }),
    queryFn: () => paymentsSdk.getSettings(params as PaymentSettingsQueryInput),
    enabled: Boolean(params?.organizationId && params?.hostelId),
  })
}

export function useSavePaymentSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PaymentSettingsInput) => paymentsSdk.saveSettings(input),
    onSuccess: (setting) => {
      queryClient.setQueryData(
        queryKeys.payments.settings({
          organizationId: setting.organization_id,
          hostelId: setting.hostel_id,
        }),
        setting
      )
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.settings({
          organizationId: setting.organization_id,
          hostelId: setting.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.settingsHistory({
          organizationId: setting.organization_id,
          hostelId: setting.hostel_id,
        }),
      })
    },
  })
}

export function usePaymentSettingsHistory(
  params: PaymentSettingsHistoryInput | undefined
) {
  return useQuery({
    queryKey: queryKeys.payments.settingsHistory({
      organizationId: params?.organizationId,
      hostelId: params?.hostelId,
    }),
    queryFn: () => paymentsSdk.listSettingsHistory(params as PaymentSettingsHistoryInput),
    enabled: Boolean(params?.organizationId && params?.hostelId),
  })
}

export function useTestPaymentSettings() {
  return useMutation({
    mutationFn: (input: PaymentSettingsTestInput) => paymentsSdk.testSettings(input),
  })
}

export function usePaymentQrUpload(options?: UploadOptions) {
  return useMutation({
    mutationFn: ({ input, file }: { input: PaymentQrUploadInput; file: File }) =>
      paymentsSdk.uploadQr(input, file, options),
  })
}

export function useResidentPaymentLedger(
  params: ResidentPaymentLedgerInput | undefined
) {
  return useQuery({
    queryKey: queryKeys.payments.ledger({
      organizationId: params?.organizationId,
    }, params?.residentId ?? "self"),
    queryFn: () => paymentsSdk.getLedger(params as ResidentPaymentLedgerInput),
    enabled: Boolean(params?.organizationId),
  })
}
