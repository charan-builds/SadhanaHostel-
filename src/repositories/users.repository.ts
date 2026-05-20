import type { AppRole } from "@/constants/auth"
import type { Tables, TablesUpdate } from "@/types/database"

import {
  createPaginationMeta,
  normalizePagination,
  sanitizeSearchTerm,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type UserRow = Tables<"users">
export type UserRoleRow = Tables<"user_roles">

export type ListUsersFilters = PaginationParams & {
  organizationId: string
  role?: AppRole
  search?: string
  isActive?: boolean
}

export class UsersRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async getById(userId: string) {
    const { data, error } = await this.db
      .from("users")
      .select("*")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load user.")
    }

    return data
  }

  async getByEmail(email: string) {
    const { data, error } = await this.db
      .from("users")
      .select("*")
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load user by email.")
    }

    return data
  }

  async listByOrganization(
    filters: ListUsersFilters
  ): Promise<PaginatedResult<UserRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)

    let query = this.db
      .from("users")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (typeof filters.isActive === "boolean") {
      query = query.eq("is_active", filters.isActive)
    }

    if (filters.role) {
      query = query.eq("default_role", filters.role)
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list users.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getRoleAssignments(userId: string, organizationId?: string) {
    let query = this.db
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load role assignments.")
    }

    return data ?? []
  }

  async updateProfile(userId: string, values: TablesUpdate<"users">) {
    const { data, error } = await this.db
      .from("users")
      .update(values)
      .eq("id", userId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update user profile.")
    }

    return data
  }
}
