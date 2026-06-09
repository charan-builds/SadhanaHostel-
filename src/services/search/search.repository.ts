import type { PostgrestError } from "@supabase/supabase-js"

import type { AppSupabaseClient, PaginationParams } from "@/repositories/types"
import {
  createPaginationMeta,
  normalizePagination,
  throwRepositoryError,
} from "@/repositories/types"

export type SearchEntityType =
  | "residents"
  | "payments"
  | "rooms"
  | "notices"
  | "complaints"
  | "reports"

export type SearchResult = {
  entity_type: SearchEntityType
  entity_id: string
  title: string
  subtitle: string | null
  rank: number
  created_at: string
}

type SearchRpcClient = {
  rpc(
    fn: "search_tenant_records",
    args: {
      p_organization_id: string
      p_hostel_id?: string | null
      p_query: string
      p_types: string[]
      p_limit: number
      p_offset: number
    }
  ): Promise<{ data: SearchResult[] | null; error: PostgrestError | null }>
}

export class SearchRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async search(input: PaginationParams & {
    organizationId: string
    hostelId?: string | null
    query: string
    types: SearchEntityType[]
  }) {
    const { page, pageSize, from } = normalizePagination(input)
    const rpc = this.db as unknown as SearchRpcClient
    const { data, error } = await rpc.rpc("search_tenant_records", {
      p_organization_id: input.organizationId,
      p_hostel_id: input.hostelId ?? null,
      p_query: input.query,
      p_types: input.types,
      p_limit: pageSize,
      p_offset: from,
    })

    if (error) {
      throwRepositoryError(error, "Unable to execute search.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(null, page, pageSize),
    }
  }
}
