"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { paymentsSdk } from "@/sdk"
import type {
  CreatePaymentInput,
  PaymentListInput,
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
