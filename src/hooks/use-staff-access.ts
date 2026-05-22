"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { staffAccessSdk } from "@/sdk"
import type {
  CreateStaffUserInput,
  ListStaffUsersInput,
  StaffAccessActionInput,
  UpdateStaffAccessInput,
} from "@/validations/staff-access.validation"

export function useStaffAccess(params: ListStaffUsersInput) {
  return useQuery({
    queryKey: queryKeys.staffAccess.list(params, params),
    queryFn: () => staffAccessSdk.list(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useCreateStaffAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateStaffUserInput) => staffAccessSdk.create(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.staffAccess.all({
          organizationId: result.account.organization_id,
          hostelId: result.account.hostel_id,
        }),
      })
    },
  })
}

export function useUpdateStaffAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateStaffAccessInput) => staffAccessSdk.update(input),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.staffAccess.all({
          organizationId: assignment.organization_id,
          hostelId: assignment.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
    },
  })
}

export function useRevokeStaffAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: StaffAccessActionInput) => staffAccessSdk.revoke(input),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.staffAccess.all({
          organizationId: assignment.organization_id,
          hostelId: assignment.hostel_id,
        }),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
    },
  })
}

export function useResetStaffPassword() {
  return useMutation({
    mutationFn: (input: StaffAccessActionInput) => staffAccessSdk.resetPassword(input),
  })
}
