"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { financeSdk } from "@/sdk"
import type {
  CollectionFollowupCompleteInput,
  CollectionFollowupCreateInput,
  CollectionFollowupListInput,
  FinanceAutomationRunInput,
  FinanceDashboardInput,
} from "@/validations/finance.validation"

export function useFinanceDashboard(params: FinanceDashboardInput | undefined) {
  return useQuery({
    queryKey: queryKeys.finance.dashboard({
      organizationId: params?.organizationId,
      hostelId: params?.hostelId,
    }),
    queryFn: () => financeSdk.dashboard(params as FinanceDashboardInput),
    enabled: Boolean(params?.organizationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 60_000,
  })
}

export function useRunFinanceAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: FinanceAutomationRunInput) => financeSdk.runAutomation(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useCollectionFollowups(params: CollectionFollowupListInput | undefined) {
  return useQuery({
    queryKey: queryKeys.finance.followups(
      {
        organizationId: params?.organizationId,
        hostelId: params?.hostelId,
      },
      params ?? {}
    ),
    queryFn: () => financeSdk.followups(params as CollectionFollowupListInput),
    enabled: Boolean(params?.organizationId),
    staleTime: 30_000,
  })
}

export function useCreateCollectionFollowup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CollectionFollowupCreateInput) => financeSdk.createFollowup(input),
    onSuccess: (_result, input) => {
      const scope = {
        organizationId: input.organizationId,
        hostelId: input.hostelId,
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(scope) })
    },
  })
}

export function useCompleteCollectionFollowup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CollectionFollowupCompleteInput & { hostelId?: string }) =>
      financeSdk.completeFollowup(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}
