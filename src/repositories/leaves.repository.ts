import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"
import { normalizeDateRange } from "@/lib/date-range"

import {
  createPaginationMeta,
  normalizePagination,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type LeaveRequestRow = Tables<"leave_requests">
export type LeaveStatus = Database["public"]["Enums"]["leave_status_enum"]

export type ListLeavesFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  residentId?: string
  status?: LeaveStatus
  fromDate?: string
  toDate?: string
}

export class LeavesRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(filters: ListLeavesFilters): Promise<PaginatedResult<LeaveRequestRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const range = normalizeDateRange(filters)

    let query = this.db
      .from("leave_requests")
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

    if (range.fromDate) {
      query = query.gte("created_at", range.fromDate)
    }

    if (range.toDate) {
      query = query.lte("created_at", range.toDate)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list leave requests.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getById(leaveRequestId: string, organizationId?: string) {
    let query = this.db
      .from("leave_requests")
      .select("*")
      .eq("id", leaveRequestId)
      .is("deleted_at", null)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load leave request.")
    }

    return data
  }

  async create(values: TablesInsert<"leave_requests">) {
    const { data, error } = await this.db
      .from("leave_requests")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create leave request.")
    }

    return data
  }

  async update(
    leaveRequestId: string,
    organizationId: string,
    values: TablesUpdate<"leave_requests">
  ) {
    const { data, error } = await this.db
      .from("leave_requests")
      .update(values)
      .eq("id", leaveRequestId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update leave request.")
    }

    return data
  }

  async listPendingParentNotifications(organizationId: string, limit = 100) {
    const { data, error } = await this.db
      .from("leave_requests")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["approved", "rejected"])
      .contains("metadata", { parent_notification_pending: true })
      .is("deleted_at", null)
      .order("reviewed_at", { ascending: true })
      .limit(limit)

    if (error) {
      throwRepositoryError(error, "Unable to load leave notification queue.")
    }

    return data ?? []
  }
}
