import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"

import {
  createPaginationMeta,
  normalizePagination,
  sanitizeSearchTerm,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type SupportRequestRow = Tables<"support_requests">
export type SupportPriority = Database["public"]["Enums"]["support_priority_enum"]
export type SupportStatus = Database["public"]["Enums"]["support_status_enum"]

export type ListSupportRequestsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string | null
  residentId?: string | null
  status?: SupportStatus
  category?: string
  priority?: SupportPriority
  workflow?: string
  search?: string
}

export class SupportRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(
    filters: ListSupportRequestsFilters
  ): Promise<PaginatedResult<SupportRequestRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)

    let query = this.db
      .from("support_requests")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.residentId) {
      query = query.eq("resident_id", filters.residentId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.category) {
      query = query.eq("category", filters.category)
    }

    if (filters.priority) {
      query = query.eq("priority", filters.priority)
    }

    if (filters.workflow) {
      query = query.contains("metadata", { workflow: filters.workflow })
    }

    if (search) {
      query = query.or(
        `subject.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list support requests.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getById(requestId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("support_requests")
      .select("*")
      .eq("id", requestId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load support request.")
    }

    return data
  }

  async findOpenByIdempotencyKey(input: {
    organizationId: string
    residentId?: string | null
    idempotencyKey: string
  }) {
    let query = this.db
      .from("support_requests")
      .select("*")
      .eq("organization_id", input.organizationId)
      .contains("metadata", { idempotencyKey: input.idempotencyKey })
      .in("status", ["open", "in_progress", "waiting_on_resident"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load recovery request.")
    }

    return data
  }

  async create(values: TablesInsert<"support_requests">) {
    const { data, error } = await this.db
      .from("support_requests")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create support request.")
    }

    return data
  }

  async update(
    requestId: string,
    organizationId: string,
    values: TablesUpdate<"support_requests">
  ) {
    const { data, error } = await this.db
      .from("support_requests")
      .update(values)
      .eq("id", requestId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update support request.")
    }

    return data
  }

  async count(filters: {
    organizationId: string
    hostelId?: string | null
    status?: SupportStatus | SupportStatus[]
    priority?: SupportPriority | SupportPriority[]
    category?: string | string[]
  }) {
    let query = this.db
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status)
    } else if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (Array.isArray(filters.priority)) {
      query = query.in("priority", filters.priority)
    } else if (filters.priority) {
      query = query.eq("priority", filters.priority)
    }

    if (Array.isArray(filters.category)) {
      query = query.in("category", filters.category)
    } else if (filters.category) {
      query = query.eq("category", filters.category)
    }

    const { error, count } = await query

    if (error) {
      throwRepositoryError(error, "Unable to count support requests.")
    }

    return count ?? 0
  }

  async countPasswordResetRequests(filters: {
    organizationId: string
    hostelId?: string | null
    status?: SupportStatus | SupportStatus[]
  }) {
    let query = this.db
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", filters.organizationId)
      .eq("category", "account")
      .contains("metadata", { workflow: "resident_password_reset" })
      .is("deleted_at", null)

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status)
    } else if (filters.status) {
      query = query.eq("status", filters.status)
    }

    const { error, count } = await query

    if (error) {
      throwRepositoryError(error, "Unable to count resident password reset requests.")
    }

    return count ?? 0
  }

  async createAuditLog(values: TablesInsert<"audit_logs">) {
    const { data, error } = await this.db
      .from("audit_logs")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to write recovery audit log.")
    }

    return data
  }
}
