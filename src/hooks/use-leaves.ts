"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { leavesSdk } from "@/sdk"
import type {
  CreateLeaveRequestInput,
  LeaveListInput,
  ReviewLeaveRequestInput,
} from "@/validations/leave.validation"

export function useLeaves(params: LeaveListInput) {
  return useQuery({
    queryKey: queryKeys.leaves.list(params, params),
    queryFn: () => leavesSdk.list(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useCreateLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => leavesSdk.create(input),
    onSuccess: (leave) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leaves.all({
          organizationId: leave.organization_id,
          hostelId: leave.hostel_id,
        }),
      })
    },
  })
}

export function useReviewLeave(action: "approve" | "reject") {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<ReviewLeaveRequestInput, "status">) =>
      action === "approve" ? leavesSdk.approve(input) : leavesSdk.reject(input),
    onSuccess: (leave) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leaves.all({
          organizationId: leave.organization_id,
          hostelId: leave.hostel_id,
        }),
      })
    },
  })
}
