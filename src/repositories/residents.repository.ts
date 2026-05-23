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
export type ResidentOnboardingStatus =
  | "invited"
  | "activated"
  | "profile_incomplete"
  | "documents_pending"
  | "verification_pending"
  | "verified"
  | "rejected"
  | "suspended"

export type ResidentWithOnboarding = ResidentRow & {
  onboarding_status?: ResidentOnboardingStatus
  student_id_document_id?: string | null
  onboarding_completed_at?: string | null
  onboarding_verified_at?: string | null
  onboarding_verified_by?: string | null
  onboarding_rejection_reason?: string | null
  onboarding_metadata?: Record<string, unknown>
}

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
      meta: createPaginationMeta(count ?? 0, page, pageSize),
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

  async findDuplicateIdentity(input: {
    organizationId: string
    residentId: string
    phone?: string
    aadhaarLast4?: string
    fullName?: string
  }) {
    let query = this.db
      .from("residents")
      .select("*")
      .eq("organization_id", input.organizationId)
      .neq("id", input.residentId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)

    if (input.phone) {
      query = query.eq("phone", input.phone)
    } else if (input.aadhaarLast4 && input.fullName) {
      query = query
        .eq("aadhaar_last4", input.aadhaarLast4)
        .ilike("full_name", input.fullName)
    } else {
      return null
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to check duplicate resident identity.")
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

  async updateExtended(
    residentId: string,
    organizationId: string,
    values: Record<string, unknown>
  ) {
    const { data, error } = await this.residentsDb()
      .from("residents")
      .update(values)
      .eq("id", residentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update resident onboarding data.")
    }

    return data as ResidentWithOnboarding
  }

  async listOnboardingQueue(filters: ListResidentsFilters & {
    onboardingStatuses?: ResidentOnboardingStatus[]
  }): Promise<PaginatedResult<ResidentWithOnboarding>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)

    let query = this.residentsDb()
      .from("residents")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.onboardingStatuses?.length) {
      query = query.in("onboarding_status", filters.onboardingStatuses)
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,admission_number.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list onboarding queue.")
    }

    return {
      data: (data ?? []) as ResidentWithOnboarding[],
      meta: createPaginationMeta(count ?? 0, page, pageSize),
    }
  }

  async transitionOnboarding(values: {
    residentId: string
    organizationId: string
    nextStatus: ResidentOnboardingStatus
    rejectionReason?: string
    actorUserId: string
  }) {
    const { data, error } = await this.residentsDb().rpc(
      "transition_resident_onboarding_atomic",
      {
        p_resident_id: values.residentId,
        p_organization_id: values.organizationId,
        p_next_status: values.nextStatus,
        p_rejection_reason: values.rejectionReason ?? null,
        p_actor_user_id: values.actorUserId,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to transition resident onboarding.")
    }

    return data as ResidentWithOnboarding
  }

  async deactivate(residentId: string, organizationId: string, actorUserId: string) {
    const { data, error } = await this.residentsDb().rpc("deactivate_resident_atomic", {
      p_organization_id: organizationId,
      p_resident_id: residentId,
      p_actor_user_id: actorUserId,
      p_reason: "Resident deactivated from admin residents workflow.",
    })

    if (error) {
      throwRepositoryError(error, "Unable to deactivate resident.")
    }

    return data as ResidentRow
  }

  async checkout(input: {
    residentId: string
    organizationId: string
    checkoutDate?: string
    actorUserId?: string
    reason?: string
  }) {
    const { data, error } = await this.residentsDb().rpc("checkout_resident_atomic", {
      p_organization_id: input.organizationId,
      p_resident_id: input.residentId,
      p_checkout_date: input.checkoutDate ?? null,
      p_actor_user_id: input.actorUserId ?? null,
      p_reason: input.reason ?? null,
    })

    if (error) {
      throwRepositoryError(error, "Unable to check out resident.")
    }

    return data as ResidentRow
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

  private residentsDb() {
    return this.db as unknown as GenericResidentsDb
  }
}

type GenericQueryResult<T> = {
  data: T | null
  error: Parameters<typeof throwRepositoryError>[0]
  count?: number | null
}

type GenericResidentsQueryBuilder = {
  select(columns?: string, options?: { count?: "exact" }): GenericResidentsQueryBuilder
  update(values: unknown): GenericResidentsQueryBuilder
  eq(column: string, value: unknown): GenericResidentsQueryBuilder
  is(column: string, value: boolean | null): GenericResidentsQueryBuilder
  in(column: string, values: unknown[]): GenericResidentsQueryBuilder
  or(filters: string): GenericResidentsQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericResidentsQueryBuilder
  range(from: number, to: number): Promise<GenericQueryResult<unknown[]>>
  single(): Promise<GenericQueryResult<unknown>>
}

type GenericResidentsDb = {
  from(table: "residents"): GenericResidentsQueryBuilder
  rpc(functionName: string, args?: Record<string, unknown>): Promise<GenericQueryResult<unknown>>
}
