"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { whatsappAutomationSdk } from "@/sdk/whatsapp-automation.sdk"
import type {
  WhatsappAutomationQueryInput,
  WhatsappProcessQueueInput,
  WhatsappQueueEventInput,
  WhatsappTemplatePreviewInput,
  WhatsappTemplateSaveInput,
  WhatsappTestSendInput,
} from "@/validations/whatsapp.validation"

export function useWhatsappAutomationDashboard(
  params: WhatsappAutomationQueryInput | undefined
) {
  return useQuery({
    queryKey: queryKeys.operations.whatsappAutomation({
      organizationId: params?.organizationId,
      hostelId: params?.hostelId,
    }),
    queryFn: () => whatsappAutomationSdk.dashboard(params as WhatsappAutomationQueryInput),
    enabled: Boolean(params?.organizationId),
    staleTime: 30_000,
  })
}

export function useSaveWhatsappTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WhatsappTemplateSaveInput) =>
      whatsappAutomationSdk.saveTemplate(input),
    onSuccess: (_template, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.whatsappAutomation({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function usePreviewWhatsappTemplate() {
  return useMutation({
    mutationFn: (input: WhatsappTemplatePreviewInput) =>
      whatsappAutomationSdk.preview(input),
  })
}

export function useQueueWhatsappEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WhatsappQueueEventInput) => whatsappAutomationSdk.queue(input),
    onSuccess: (_queue, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.whatsappAutomation({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useProcessWhatsappQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WhatsappProcessQueueInput) =>
      whatsappAutomationSdk.process(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.whatsappAutomation({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useTestWhatsappSend() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WhatsappTestSendInput) => whatsappAutomationSdk.testSend(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.whatsappAutomation({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}
