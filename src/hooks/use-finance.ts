"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { financeSdk } from "@/sdk"
import type {
  AdvanceAllocationRunInput,
  AdvanceDepositCreateInput,
  AdvanceLedgerQueryInput,
  AdvanceRefundApproveInput,
  AdvanceRefundCreateInput,
  AdvanceReportsInput,
  AdvanceSettlementInput,
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

export function useAdvanceLedger(params: AdvanceLedgerQueryInput | undefined) {
  return useQuery({
    queryKey: queryKeys.finance.advanceLedger(
      {
        organizationId: params?.organizationId,
        hostelId: params?.hostelId,
      },
      params?.residentId ?? "self"
    ),
    queryFn: () => financeSdk.advanceLedger(params as AdvanceLedgerQueryInput),
    enabled: Boolean(params?.organizationId),
    staleTime: 30_000,
  })
}

export function useAdvanceReports(params: AdvanceReportsInput | undefined) {
  return useQuery({
    queryKey: queryKeys.finance.advanceReports(
      {
        organizationId: params?.organizationId,
        hostelId: params?.hostelId,
      },
      params ?? {}
    ),
    queryFn: () => financeSdk.advanceReports(params as AdvanceReportsInput),
    enabled: Boolean(params?.organizationId),
    staleTime: 30_000,
  })
}

export function useAdvanceSettlement(params: AdvanceSettlementInput | undefined) {
  return useQuery({
    queryKey: queryKeys.finance.advanceSettlement(
      { organizationId: params?.organizationId },
      params?.residentId ?? "none"
    ),
    queryFn: () => financeSdk.advanceSettlement(params as AdvanceSettlementInput),
    enabled: Boolean(params?.organizationId && params?.residentId),
    staleTime: 0,
  })
}

export function useRecordAdvanceDeposit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AdvanceDepositCreateInput) => financeSdk.recordAdvanceDeposit(input),
    onSuccess: (_deposit, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useAllocateAdvance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AdvanceAllocationRunInput) => financeSdk.allocateAdvance(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useRequestAdvanceRefund() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AdvanceRefundCreateInput) => financeSdk.requestAdvanceRefund(input),
    onSuccess: (_refund, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useApproveAdvanceRefund() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AdvanceRefundApproveInput & { hostelId?: string }) =>
      financeSdk.approveAdvanceRefund(input),
    onSuccess: (_refund, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}
