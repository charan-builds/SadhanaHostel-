import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"
import { normalizeDateRange } from "@/lib/date-range"

import {
  createPaginationMeta,
  normalizePagination,
  sanitizeSearchTerm,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type NoticeRow = Tables<"notices">
export type NoticeCmsStatus = Database["public"]["Enums"]["cms_status_enum"]

export type ListNoticesFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  status?: NoticeCmsStatus
  audienceType?: string
  activeOnly?: boolean
  search?: string
  fromDate?: string
  toDate?: string
}

export class NoticesRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(filters: ListNoticesFilters): Promise<PaginatedResult<NoticeRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)
    const range = normalizeDateRange(filters)

    let query = this.db
      .from("notices")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })

    if (filters.hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${filters.hostelId}`)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.audienceType) {
      query = query.eq("audience_type", filters.audienceType)
    }

    if (filters.activeOnly) {
      query = query.eq("is_active", true)
    }

    if (range.fromDate) {
      query = query.gte("published_at", range.fromDate)
    }

    if (range.toDate) {
      query = query.lte("published_at", range.toDate)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list notices.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getById(noticeId: string, organizationId?: string) {
    let query = this.db
      .from("notices")
      .select("*")
      .eq("id", noticeId)
      .is("deleted_at", null)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load notice.")
    }

    return data
  }

  async create(values: TablesInsert<"notices">) {
    const { data, error } = await this.db
      .from("notices")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create notice.")
    }

    return data
  }

  async update(noticeId: string, organizationId: string, values: TablesUpdate<"notices">) {
    const { data, error } = await this.db
      .from("notices")
      .update(values)
      .eq("id", noticeId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update notice.")
    }

    return data
  }

  async listPublishedForFanout(organizationId: string, runAt: string, limit = 100) {
    const { data, error } = await this.db
      .from("notices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .eq("is_active", true)
      .lte("published_at", runAt)
      .or(`expires_at.is.null,expires_at.gt.${runAt}`)
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(limit)

    if (error) {
      throwRepositoryError(error, "Unable to load published notices for fan-out.")
    }

    return data ?? []
  }

  async listAcknowledgementRequired(input: {
    organizationId: string
    hostelId?: string | null
  }) {
    let query = this.db
      .from("notices")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("requires_acknowledgement", true)
      .eq("is_active", true)
      .is("deleted_at", null)

    if (input.hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${input.hostelId}`)
    }

    const { data, error } = await query
      .order("published_at", { ascending: false })
      .range(0, 5_000)

    if (error) {
      throwRepositoryError(
        error,
        "Unable to load acknowledgement-required notices."
      )
    }

    return data ?? []
  }
}
