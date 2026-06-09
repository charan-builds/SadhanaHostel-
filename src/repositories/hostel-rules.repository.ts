import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"

import {
  createPaginationMeta,
  normalizePagination,
  sanitizeSearchTerm,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type HostelRuleRow = Tables<"hostel_rules">
export type HostelRuleAcceptanceRow = Tables<"hostel_rule_acceptances">

export type ListHostelRulesFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  category?: string
  activeOnly?: boolean
  search?: string
  allowMissingTableFallback?: boolean
}

export class HostelRulesRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(filters: ListHostelRulesFilters): Promise<PaginatedResult<HostelRuleRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const search = sanitizeSearchTerm(filters.search)

    let query = this.db
      .from("hostel_rules")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (filters.hostelId) {
      query = query.or(`hostel_id.is.null,hostel_id.eq.${filters.hostelId}`)
    }

    if (filters.category) {
      query = query.eq("category", filters.category)
    }

    if (filters.activeOnly) {
      query = query.eq("is_active", true)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      if (error.code === "PGRST205" && filters.allowMissingTableFallback) {
        return {
          data: [],
          meta: createPaginationMeta(0, page, pageSize),
        }
      }

      throwRepositoryError(error, "Unable to list hostel rules.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getById(ruleId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("hostel_rules")
      .select("*")
      .eq("id", ruleId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load hostel rule.")
    }

    return data
  }

  async create(values: TablesInsert<"hostel_rules">) {
    const { data, error } = await this.db
      .from("hostel_rules")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create hostel rule.")
    }

    return data
  }

  async update(ruleId: string, organizationId: string, values: TablesUpdate<"hostel_rules">) {
    const { data, error } = await this.db
      .from("hostel_rules")
      .update(values)
      .eq("id", ruleId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update hostel rule.")
    }

    return data
  }

  async getAcceptance(input: {
    organizationId: string
    residentId: string
    rulesVersion: string
  }) {
    const { data, error } = await this.db
      .from("hostel_rule_acceptances")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("resident_id", input.residentId)
      .eq("rules_version", input.rulesVersion)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load hostel rules acceptance.")
    }

    return data
  }

  async getLatestAcceptance(input: { organizationId: string; residentId: string }) {
    const { data, error } = await this.db
      .from("hostel_rule_acceptances")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("resident_id", input.residentId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load latest hostel rules acceptance.")
    }

    return data
  }

  async upsertAcceptance(values: TablesInsert<"hostel_rule_acceptances">) {
    const { data, error } = await this.db
      .from("hostel_rule_acceptances")
      .upsert(values, { onConflict: "resident_id,rules_version" })
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to accept hostel rules.")
    }

    return data
  }
}
