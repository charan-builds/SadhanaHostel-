"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { residentsSdk } from "@/sdk"
import type {
  CreateResidentInput,
  ResidentListInput,
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

export function useCreateResident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateResidentInput) => residentsSdk.create(input),
    onSuccess: (resident) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.residents.all({
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
        }),
      })
    },
  })
}

export function useUpdateResident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateResidentInput) => residentsSdk.update(input),
    onSuccess: (resident) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.residents.all({
          organizationId: resident.organization_id,
          hostelId: resident.hostel_id,
        }),
      })
    },
  })
}
