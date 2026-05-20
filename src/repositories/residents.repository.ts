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

export type ResidentRow = Tables<"residents">
export type ResidentStatus = Database["public"]["Enums"]["resident_status_enum"]
export type ResidentType = Database["public"]["Enums"]["resident_type_enum"]

export type ListResidentsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  status?: ResidentStatus
  residentType?: ResidentType
  search?: string
}

export class ResidentsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(filters: ListResidentsFilters): Promise<PaginatedResult<ResidentRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)

    let query = this.db
      .from("residents")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.residentType) {
      query = query.eq("resident_type", filters.residentType)
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,admission_number.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list residents.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getById(residentId: string, organizationId?: string) {
    let query = this.db
      .from("residents")
      .select("*")
      .eq("id", residentId)
      .is("deleted_at", null)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load resident.")
    }

    return data
  }

  async getByUserId(userId: string, organizationId?: string) {
    let query = this.db
      .from("residents")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load resident profile.")
    }

    return data
  }

  async create(values: TablesInsert<"residents">) {
    const { data, error } = await this.db
      .from("residents")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create resident.")
    }

    return data
  }

  async update(
    residentId: string,
    organizationId: string,
    values: TablesUpdate<"residents">
  ) {
    const { data, error } = await this.db
      .from("residents")
      .update(values)
      .eq("id", residentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update resident.")
    }

    return data
  }

  async deactivate(residentId: string, organizationId: string, actorUserId: string) {
    const { data, error } = await this.db
      .from("residents")
      .update({
        status: "archived",
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: actorUserId,
        updated_by: actorUserId,
      })
      .eq("id", residentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to deactivate resident.")
    }

    return data
  }

  async linkUser(residentId: string, userId: string) {
    const { data, error } = await this.db.rpc("onboard_resident", {
      target_resident_id: residentId,
      target_user_id: userId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to onboard resident.")
    }

    return data
  }

  async listActiveForBilling(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("residents")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load residents for billing.")
    }

    return data ?? []
  }
}
