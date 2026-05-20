import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type {
  CreateNoticeInput,
  NoticeListInput,
  UpdateNoticeInput,
} from "@/validations/notice.validation"

import type { PaginatedResult } from "./types"

export const noticesSdk = {
  list(params: NoticeListInput) {
    return apiClient.get<PaginatedResult<Tables<"notices">>>(
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
}
