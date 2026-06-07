import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type { NoticeWithEngagement } from "@/types/notices"
import type {
  AcknowledgeNoticeInput,
  CreateNoticeInput,
  MarkNoticeReadInput,
  NoticeListInput,
  UpdateNoticeInput,
} from "@/validations/notice.validation"

import type { PaginatedResult } from "./types"

export const noticesSdk = {
  list(params: NoticeListInput) {
    return apiClient.get<PaginatedResult<NoticeWithEngagement>>(
      "/api/notices",
      params
    )
  },

  create(input: CreateNoticeInput) {
    return apiClient.post<Tables<"notices">, CreateNoticeInput>(
      "/api/notices",
      input
    )
  },

  update(input: UpdateNoticeInput) {
    const { noticeId, ...body } = input

    return apiClient.patch<Tables<"notices">, Omit<UpdateNoticeInput, "noticeId">>(
      `/api/notices/${noticeId}`,
      body
    )
  },

  markRead(noticeId: string, input: MarkNoticeReadInput) {
    return apiClient.post<NoticeWithEngagement, MarkNoticeReadInput>(
      `/api/notices/${noticeId}/read`,
      input,
      { retry: 0 }
    )
  },

  acknowledge(noticeId: string, input: AcknowledgeNoticeInput) {
    return apiClient.post<NoticeWithEngagement, AcknowledgeNoticeInput>(
      `/api/notices/${noticeId}/acknowledge`,
      input,
      { retry: 0 }
    )
  },
}
