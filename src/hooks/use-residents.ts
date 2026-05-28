"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { residentsSdk } from "@/sdk"
import type {
  CheckoutResidentInput,
  CreateResidentInput,
  RepairResidentLifecycleInput,
  ResidentListInput,
  UpdateOwnResidentProfileInput,
  UpdateResidentInput,
} from "@/validations/resident.validation"

export function useResidents(params: ResidentListInput) {
  return useQuery({
    queryKey: queryKeys.residents.list(params, params),
    queryFn: () => residentsSdk.list(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useResident(residentId: string | undefined, organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.detail({ organizationId }, residentId ?? "new"),
    queryFn: () => residentsSdk.get(String(residentId), String(organizationId)),
    enabled: Boolean(residentId && organizationId),
  })
}

export function useCurrentResident(organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.detail({ organizationId }, "me"),
    queryFn: () => residentsSdk.me(String(organizationId)),
    enabled: Boolean(organizationId),
  })
}

export function useCreateResident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateResidentInput) => residentsSdk.create(input),
    onSuccess: ({ resident }) => {
      invalidateResidentOperationalState(queryClient, resident.organization_id, resident.hostel_id)
    },
  })
}

export function useUpdateResident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateResidentInput) => residentsSdk.update(input),
    onSuccess: (resident) => {
      invalidateResidentOperationalState(queryClient, resident.organization_id, resident.hostel_id)
    },
  })
}

export function useUpdateCurrentResident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateOwnResidentProfileInput) => residentsSdk.updateMe(input),
    onSuccess: (resident) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.residents.detail(
          { organizationId: resident.organization_id, hostelId: resident.hostel_id },
          "me"
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.residents.detail({ organizationId: resident.organization_id }, "me"),
      })
      invalidateResidentOperationalState(queryClient, resident.organization_id, resident.hostel_id)
    },
  })
}

export function useDeactivateResident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { residentId: string; organizationId: string }) =>
      residentsSdk.deactivate(input),
    onSuccess: (resident) => {
      invalidateResidentOperationalState(queryClient, resident.organization_id, resident.hostel_id)
    },
  })
}

export function useCheckoutResident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CheckoutResidentInput) => residentsSdk.checkout(input),
    onSuccess: (resident) => {
      invalidateResidentOperationalState(queryClient, resident.organization_id, resident.hostel_id)
    },
  })
}

export function useRepairResidentLifecycle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RepairResidentLifecycleInput) => residentsSdk.repairLifecycle(input),
    onSuccess: (result) => {
      invalidateResidentOperationalState(queryClient, result.organizationId, result.hostelId)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.residents.detail(
          { organizationId: result.organizationId, hostelId: result.hostelId },
          result.residentId
        ),
      })
    },
  })
}

function invalidateResidentOperationalState(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  hostelId?: string | null
) {
  const scope = { organizationId, hostelId }

  void queryClient.invalidateQueries({ queryKey: queryKeys.residents.all(scope) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all(scope) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all(scope) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all(scope) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all(scope) })
}
