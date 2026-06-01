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
      .select("*")
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

    const roleRows = (data ?? []) as StaffRoleRow[]
    const usersById = await this.loadUsersById(
      roleRows.map((row) => row.user_id),
      filters.organizationId
    )
    const hostelsById = await this.loadHostelsById(
      roleRows.map((row) => row.hostel_id).filter(Boolean) as string[],
      filters.organizationId
    )
    const rows = roleRows.flatMap((row): StaffAccountRow[] => {
      const user = usersById.get(row.user_id)

      if (!user) {
        return []
      }

      return [
        {
          ...row,
          user,
          hostel: row.hostel_id ? hostelsById.get(row.hostel_id) ?? null : null,
        },
      ]
    }).filter((row) => {
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

  private async loadUsersById(userIds: string[], organizationId: string) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))]

    if (uniqueUserIds.length === 0) {
      return new Map<string, StaffUserRow>()
    }

    const { data, error } = await this.db
      .from("users")
      .select("*")
      .in("id", uniqueUserIds)
      .is("deleted_at", null)

    if (error) {
      throwRepositoryError(error, "Unable to load staff user profiles.")
    }

    const users = (data ?? []).filter(
      (user) => !user.organization_id || user.organization_id === organizationId
    )

    return new Map(users.map((user) => [user.id, user]))
  }

  private async loadHostelsById(hostelIds: string[], organizationId: string) {
    const uniqueHostelIds = [...new Set(hostelIds.filter(Boolean))]

    if (uniqueHostelIds.length === 0) {
      return new Map<string, StaffHostelSummary>()
    }

    const { data, error } = await this.db
      .from("hostels")
      .select("id, name, code")
      .eq("organization_id", organizationId)
      .in("id", uniqueHostelIds)
      .is("deleted_at", null)

    if (error) {
      throwRepositoryError(error, "Unable to load staff hostel scopes.")
    }

    return new Map((data ?? []).map((hostel) => [hostel.id, hostel]))
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
    const existing = await this.getRoleAssignmentByScope({
      organizationId: values.organization_id,
      hostelId: values.hostel_id ?? null,
      userId: values.user_id,
      role: values.role,
    })

    if (existing) {
      return this.updateRoleAssignment(existing.id, values.organization_id, {
        hostel_id: values.hostel_id,
        role: values.role,
        permissions: values.permissions,
        status: values.status,
        invited_by: values.invited_by,
        invited_at: values.invited_at,
        accepted_at: values.accepted_at,
        updated_by: values.updated_by,
        deleted_at: null,
        deleted_by: null,
      })
    }

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

  async getRoleAssignmentByScope(input: {
    organizationId: string
    hostelId?: string | null
    userId: string
    role: AppRole
  }) {
    let query = this.db
      .from("user_roles")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .eq("role", input.role)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)

    query = input.hostelId
      ? query.eq("hostel_id", input.hostelId)
      : query.is("hostel_id", null)

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load existing staff role assignment.")
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

  async getRoleAssignmentById(roleAssignmentId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("user_roles")
      .select("*")
      .eq("id", roleAssignmentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
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
