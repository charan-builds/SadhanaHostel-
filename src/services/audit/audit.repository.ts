import type { Tables } from "@/types/database"
import type { AuditCategory, AuditListInput } from "@/validations/audit.validation"

import {
  createPaginationMeta,
  normalizePagination,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
} from "@/repositories/types"

export type AuditLogRow = Tables<"audit_logs">

const CATEGORY_FILTERS: Record<
  AuditCategory,
  {
    tables?: string[]
    actionPrefixes?: string[]
  }
> = {
  activity: {},
  payments: {
    tables: ["payments", "monthly_fee_records", "invoices", "payment_webhooks"],
    actionPrefixes: ["payment.", "job.payment", "invoice."],
  },
  residents: {
    tables: ["residents", "room_allocations", "documents"],
    actionPrefixes: ["resident.", "onboarding"],
  },
  security: {
    tables: ["users", "user_roles", "auth", "storage.objects"],
    actionPrefixes: ["auth.", "security.", "cron.auth"],
  },
  logins: {
    tables: ["auth", "users"],
    actionPrefixes: ["auth.login", "auth.logout", "session."],
  },
}

export class AuditRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(
    category: AuditCategory,
    filters: AuditListInput
  ): Promise<PaginatedResult<AuditLogRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)
    const categoryFilter = CATEGORY_FILTERS[category]

    let query = this.db
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .order("created_at", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.actorUserId) {
      query = query.eq("actor_user_id", filters.actorUserId)
    }

    if (filters.recordId) {
      query = query.eq("record_id", filters.recordId)
    }

    if (filters.tableName) {
      query = query.eq("table_name", filters.tableName)
    } else if (categoryFilter.tables?.length) {
      query = query.in("table_name", categoryFilter.tables)
    }

    if (filters.action) {
      query = query.eq("action", filters.action)
    } else if (categoryFilter.actionPrefixes?.length) {
      query = query.or(
        categoryFilter.actionPrefixes
          .map((prefix) => `action.ilike.${prefix.replace(/[%,]/g, "")}%`)
          .join(",")
      )
    }

    if (filters.fromDate) {
      query = query.gte("created_at", filters.fromDate)
    }

    if (filters.toDate) {
      query = query.lte("created_at", filters.toDate)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to load audit logs.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }
}
