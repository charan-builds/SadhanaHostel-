import type { AppRole } from "@/constants/auth"
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"
import type { StaffAccountState, StaffRole } from "@/validations/staff-access.validation"

import {
  createPaginationMeta,
  normalizePagination,
  sanitizeSearchTerm,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type StaffUserRow = Tables<"users">
export type StaffRoleRow = Tables<"user_roles">
export type StaffHostelSummary = Pick<Tables<"hostels">, "id" | "name" | "code">

export type StaffAccountRow = StaffRoleRow & {
  user: StaffUserRow
  hostel: StaffHostelSummary | null
}

export type ListStaffFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  role?: StaffRole
  status?: StaffAccountState
  search?: string
}

const staffRoles = ["owner", "admin", "finance", "receptionist", "warden", "staff"] satisfies AppRole[]
const privilegedRoles = ["owner", "admin"] satisfies AppRole[]

export class StaffAccessRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async listStaff(filters: ListStaffFilters): Promise<PaginatedResult<StaffAccountRow>> {
    const { page, pageSize } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)?.toLowerCase()

    let query = this.db
      .from("user_roles")
      .select("*, user:users(*), hostel:hostels(id, name, code)")
      .eq("organization_id", filters.organizationId)
      .in("role", filters.role ? [filters.role] : staffRoles)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    const { data, error } = await query.limit(500)

    if (error) {
      throwRepositoryError(error, "Unable to list staff access records.")
    }

    const rows = ((data ?? []) as unknown as StaffAccountRow[]).filter((row) => {
      if (!search) {
        return true
      }

      return [row.user.full_name, row.user.email, row.user.phone, row.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    })
    const from = (page - 1) * pageSize
    const to = from + pageSize

    return {
      data: rows.slice(from, to),
      meta: createPaginationMeta(rows.length, page, pageSize),
    }
  }

  async getUserByEmail(email: string) {
    const { data, error } = await this.db
      .from("users")
      .select("*")
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load staff user by email.")
    }

    return data
  }

  async getUserById(userId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load staff user.")
    }

    return data
  }

  async updateUser(userId: string, values: TablesUpdate<"users">) {
    const { data, error } = await this.db
      .from("users")
      .update(values)
      .eq("id", userId)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update staff user.")
    }

    return data
  }

  async createRoleAssignment(values: TablesInsert<"user_roles">) {
    const { data, error } = await this.db
      .from("user_roles")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create staff role assignment.")
    }

    return data
  }

  async updateRoleAssignment(
    roleAssignmentId: string,
    organizationId: string,
    values: TablesUpdate<"user_roles">
  ) {
    const { data, error } = await this.db
      .from("user_roles")
      .update(values)
      .eq("id", roleAssignmentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update staff role assignment.")
    }

    return data
  }

  async getPrimaryRoleAssignment(userId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .in("role", staffRoles)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load staff role assignment.")
    }

    return data
  }

  async countActivePrivileged(organizationId: string, excludeUserId?: string) {
    let query = this.db
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("role", privilegedRoles)
      .eq("status", "active")
      .is("deleted_at", null)

    if (excludeUserId) {
      query = query.neq("user_id", excludeUserId)
    }

    const { error, count } = await query

    if (error) {
      throwRepositoryError(error, "Unable to count privileged staff.")
    }

    return count ?? 0
  }
}
