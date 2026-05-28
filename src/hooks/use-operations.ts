"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { operationsSdk } from "@/sdk"
import type {
  AutomationDashboardQueryInput,
  AutomationRunInput,
  AutomationSettingsInput,
  ConsistencyRepairInput,
  ConsistencyReportQueryInput,
  DemoDataResetInput,
  IdentityReconciliationQueryInput,
  IdentityRepairInput,
} from "@/validations/operations.validation"

export function useAutomationDashboard(params: AutomationDashboardQueryInput) {
  return useQuery({
    queryKey: queryKeys.operations.automation(params),
    queryFn: () => operationsSdk.automationDashboard(params),
    enabled: Boolean(params.organizationId),
    staleTime: 30_000,
  })
}

export function useRunAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AutomationRunInput) => operationsSdk.runAutomation(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.support.alerts({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useUpdateAutomationSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AutomationSettingsInput) =>
      operationsSdk.updateAutomationSettings(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
    },
  })
}

export function useConsistencyReport(params: ConsistencyReportQueryInput) {
  return useQuery({
    queryKey: queryKeys.operations.consistency(params),
    queryFn: () => operationsSdk.consistencyReport(params),
    enabled: Boolean(params.organizationId),
    staleTime: 30_000,
  })
}

export function useRepairConsistency() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ConsistencyRepairInput) => operationsSdk.repairConsistency(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.all({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.support.alerts({
          organizationId: input.organizationId,
          hostelId: input.hostelId,
        }),
      })
      if (input.action === "recalculate_occupancy") {
        const scope = { organizationId: input.organizationId, hostelId: input.hostelId }

        void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all(scope) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all(scope) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.residents.all(scope) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all(scope) })
      }
    },
  })
}

export function useResetDemoData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: DemoDataResetInput) => operationsSdk.resetDemoData(input),
    onSuccess: (_result, input) => {
      const scope = { organizationId: input.organizationId, hostelId: input.hostelId }

      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.all(scope),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.residents.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all(scope) })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.support.alerts(scope),
      })
    },
  })
}

export function useIdentityReconciliation(params: IdentityReconciliationQueryInput) {
  return useQuery({
    queryKey: queryKeys.operations.identity(params),
    queryFn: () => operationsSdk.identityReconciliation(params),
    enabled: Boolean(params.organizationId),
    staleTime: 30_000,
  })
}

export function useRepairIdentities() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: IdentityRepairInput) => operationsSdk.repairIdentities(input),
    onSuccess: (_result, input) => {
      const scope = { organizationId: input.organizationId, hostelId: input.hostelId }

      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.residents.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.staffAccess.all(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.support.alerts(scope) })
    },
  })
}
