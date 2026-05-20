"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { noticesSdk } from "@/sdk"
import type {
  CreateNoticeInput,
  NoticeListInput,
  UpdateNoticeInput,
} from "@/validations/notice.validation"

export function useNotices(params: NoticeListInput) {
  return useQuery({
    queryKey: queryKeys.notices.list(params, params),
    queryFn: () => noticesSdk.list(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useCreateNotice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateNoticeInput) => noticesSdk.create(input),
    onSuccess: (notice) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notices.all({
          organizationId: notice.organization_id,
          hostelId: notice.hostel_id,
        }),
      })
    },
  })
}

export function useUpdateNotice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateNoticeInput) => noticesSdk.update(input),
    onSuccess: (notice) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notices.all({
          organizationId: notice.organization_id,
          hostelId: notice.hostel_id,
        }),
      })
    },
  })
}
