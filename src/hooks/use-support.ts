"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { supportSdk } from "@/sdk"
import type {
  OperationalAlertsQueryInput,
  ResidentPasswordResetRequestInput,
  SupportPasswordResetApprovalInput,
  SupportRequestCreateInput,
  SupportRequestListInput,
  SupportRequestUpdateInput,
} from "@/validations/support.validation"

export function useSupportRequests(params: SupportRequestListInput) {
  return useQuery({
    queryKey: queryKeys.support.requests(params, params),
    queryFn: () => supportSdk.listRequests(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useCreateSupportRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SupportRequestCreateInput) => supportSdk.createRequest(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.support.all({
          organizationId: result.request.organization_id,
          hostelId: result.request.hostel_id,
        }),
      })
    },
  })
}

export function useCreateResidentPasswordResetRequest() {
  return useMutation({
    mutationFn: (input: ResidentPasswordResetRequestInput) =>
      supportSdk.createResidentPasswordResetRequest(input),
  })
}

export function useUpdateSupportRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SupportRequestUpdateInput) => supportSdk.updateRequest(input),
    onSuccess: (request) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.support.all({
          organizationId: request.organization_id,
          hostelId: request.hostel_id,
        }),
      })
    },
  })
}

export function useApproveResidentPasswordResetRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SupportPasswordResetApprovalInput) =>
      supportSdk.approveResidentPasswordResetRequest(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.support.all({
          organizationId: result.request.organization_id,
          hostelId: result.request.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.residents.all({
          organizationId: result.request.organization_id,
          hostelId: result.request.hostel_id,
        }),
      })
    },
  })
}

export function useOperationalAlerts(params: OperationalAlertsQueryInput) {
  return useQuery({
    queryKey: queryKeys.support.alerts(params),
    queryFn: () => supportSdk.operationalAlerts(params),
    enabled: Boolean(params.organizationId),
    staleTime: 30_000,
  })
}
