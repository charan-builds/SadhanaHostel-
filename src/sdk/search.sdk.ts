import { apiClient } from "@/lib/api-client"
import type { PaginatedResult, SearchResult } from "@/sdk/types"
import type { z } from "zod"
import type { globalSearchSchema } from "@/validations/search.validation"

export type SearchInput = z.infer<typeof globalSearchSchema>

export const searchSdk = {
  search(params: SearchInput) {
    return apiClient.get<PaginatedResult<SearchResult>>("/api/v1/search", {
      ...params,
      types: params.types.join(","),
    })
  },
}
