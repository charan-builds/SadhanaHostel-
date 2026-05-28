import type { PostgrestError } from "@supabase/supabase-js"

import type { Json, TablesInsert } from "@/types/database"
import type { ConsistencyFinding } from "@/types/operations"
import type { ResidentLifecycleRepairResult } from "@/types/residents"

import { throwRepositoryError, type AppSupabaseClient } from "./types"

type QueryResult<T> = {
  data: T | null
  error: PostgrestError | null
  count?: number | null
}

type GenericQueryBuilder = {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): GenericQueryBuilder
  insert(values: unknown): GenericQueryBuilder
  update(values: unknown): GenericQueryBuilder
  eq(column: string, value: unknown): GenericQueryBuilder
  neq(column: string, value: unknown): GenericQueryBuilder
  is(column: string, value: boolean | null): GenericQueryBuilder
  in(column: string, values: unknown[]): GenericQueryBuilder
  lte(column: string, value: unknown): GenericQueryBuilder
  gt(column: string, value: unknown): GenericQueryBuilder
  gte(column: string, value: unknown): GenericQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericQueryBuilder
  limit(count: number): GenericQueryBuilder
  range(from: number, to: number): Promise<QueryResult<unknown[]>>
  maybeSingle(): Promise<QueryResult<unknown>>
  single(): Promise<QueryResult<unknown>>
}

type GenericOperationsDb = {
  from(table: string): GenericQueryBuilder
  rpc(functionName: string, args?: Record<string, unknown>): Promise<QueryResult<unknown>>
}

export class OperationsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async count(table: string, input: {
    organizationId: string
    hostelId?: string | null
    equals?: Record<string, unknown>
    in?: Record<string, unknown[]>
    isNull?: string[]
    isNotNull?: string[]
    lte?: Record<string, unknown>
    gte?: Record<string, unknown>
    deletedAtNull?: boolean
  }) {
    let query = this.operationsDb()
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", input.organizationId)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.deletedAtNull) {
      query = query.is("deleted_at", null)
    }

    Object.entries(input.equals ?? {}).forEach(([column, value]) => {
      query = query.eq(column, value)
    })

    Object.entries(input.in ?? {}).forEach(([column, values]) => {
      query = query.in(column, values)
    })

    input.isNull?.forEach((column) => {
      query = query.is(column, null)
    })

    input.isNotNull?.forEach((column) => {
      query = query.neq(column, null)
    })

    Object.entries(input.lte ?? {}).forEach(([column, value]) => {
      query = query.lte(column, value)
    })

    Object.entries(input.gte ?? {}).forEach(([column, value]) => {
      query = query.gte(column, value)
    })

    const { error, count } = await query.range(0, 0)

    if (error) {
      throwRepositoryError(error, `Unable to count ${table}.`)
    }

    return count ?? 0
  }

  async list(table: string, input: {
    organizationId: string
    hostelId?: string | null
    select?: string
    equals?: Record<string, unknown>
    in?: Record<string, unknown[]>
    isNull?: string[]
    isNotNull?: string[]
    lte?: Record<string, unknown>
    gt?: Record<string, unknown>
    gte?: Record<string, unknown>
    deletedAtNull?: boolean
    limit?: number
  }) {
    let query = this.operationsDb()
      .from(table)
      .select(input.select ?? "*")
      .eq("organization_id", input.organizationId)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.deletedAtNull) {
      query = query.is("deleted_at", null)
    }

    Object.entries(input.equals ?? {}).forEach(([column, value]) => {
      query = query.eq(column, value)
    })

    Object.entries(input.in ?? {}).forEach(([column, values]) => {
      query = query.in(column, values)
    })

    input.isNull?.forEach((column) => {
      query = query.is(column, null)
    })

    input.isNotNull?.forEach((column) => {
      query = query.neq(column, null)
    })

    Object.entries(input.lte ?? {}).forEach(([column, value]) => {
      query = query.lte(column, value)
    })

    Object.entries(input.gt ?? {}).forEach(([column, value]) => {
      query = query.gt(column, value)
    })

    Object.entries(input.gte ?? {}).forEach(([column, value]) => {
      query = query.gte(column, value)
    })

    const { data, error } = await query.limit(input.limit ?? 1000).range(0, (input.limit ?? 1000) - 1)

    if (error) {
      throwRepositoryError(error, `Unable to list ${table}.`)
    }

    return (data ?? []) as Array<Record<string, unknown>>
  }

  async completeCheckedOutAllocations(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
  }) {
    const residents = await this.list("residents", {
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      select: "id",
      equals: { status: "checked_out" },
      deletedAtNull: true,
      limit: 1000,
    })
    const residentIds = residents
      .map((resident) => resident.id)
      .filter((id): id is string => typeof id === "string")

    if (residentIds.length === 0) {
      return 0
    }

    let query = this.operationsDb()
      .from("room_allocations")
      .update({
        status: "completed",
        allocated_to: new Date().toISOString().slice(0, 10),
        updated_by: input.actorUserId ?? null,
      })
      .eq("organization_id", input.organizationId)
      .in("resident_id", residentIds)
      .eq("status", "active")
      .is("deleted_at", null)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.select("id").range(0, 1000)

    if (error) {
      throwRepositoryError(error, "Unable to complete checked-out allocations.")
    }

    return (data ?? []).length
  }

  async recordConsistencyReport(input: {
    organizationId: string
    hostelId?: string | null
    findings: ConsistencyFinding[]
    score: number
    runId?: string | null
    actorUserId?: string | null
  }) {
    return this.createAuditLog({
      organization_id: input.organizationId,
      hostel_id: input.hostelId ?? null,
      actor_user_id: input.actorUserId ?? null,
      table_name: "operational_consistency",
      record_id: null,
      request_id: input.runId ?? null,
      action: "consistency.report.generated",
      metadata: {
        score: input.score,
        finding_count: input.findings.length,
        findings: input.findings,
      } satisfies Json,
      created_by: input.actorUserId ?? null,
      updated_by: input.actorUserId ?? null,
    })
  }

  async listRecentJobEvents(organizationId: string, limit = 25) {
    const { data, error } = await this.operationsDb()
      .from("audit_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .in("action", ["job.completed", "job.failed", "job.skipped"])
      .order("created_at", { ascending: false })
      .limit(limit)
      .range(0, limit - 1)

    if (error) {
      throwRepositoryError(error, "Unable to load recent automation runs.")
    }

    return (data ?? []) as Array<{
      id: string
      action: string
      created_at: string
      request_id: string | null
      metadata: Json
    }>
  }

  async listAutomationSettings(organizationId: string, hostelId?: string | null) {
    let query = this.operationsDb()
      .from("automation_job_settings")
      .select("*")
      .eq("organization_id", organizationId)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.order("job_name", { ascending: true }).range(0, 500)

    if (error) {
      throwRepositoryError(error, "Unable to load automation settings.")
    }

    return (data ?? []) as Array<{
      id: string
      organization_id: string
      hostel_id: string | null
      job_name: string
      enabled: boolean
      cron_schedule: string
      dry_run_only: boolean
      config: Json
      created_at: string
      updated_at: string
    }>
  }

  async getAutomationSetting(input: {
    organizationId: string
    hostelId?: string | null
    jobName: string
  }) {
    let query = this.operationsDb()
      .from("automation_job_settings")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("job_name", input.jobName)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    } else {
      query = query.is("hostel_id", null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load automation setting.")
    }

    return data as {
      enabled: boolean
      cron_schedule: string
      dry_run_only: boolean
      config: Json
    } | null
  }

  async upsertAutomationSetting(input: {
    organizationId: string
    hostelId?: string | null
    jobName: string
    enabled: boolean
    cronSchedule: string
    dryRunOnly?: boolean
    config?: Json
    actorUserId?: string | null
  }) {
    const { data, error } = await this.operationsDb()
      .from("automation_job_settings")
      .insert({
        organization_id: input.organizationId,
        hostel_id: input.hostelId ?? null,
        job_name: input.jobName,
        enabled: input.enabled,
        cron_schedule: input.cronSchedule,
        dry_run_only: input.dryRunOnly ?? false,
        config: input.config ?? {},
        created_by: input.actorUserId ?? null,
        updated_by: input.actorUserId ?? null,
      })
      .select("*")
      .single()

    if (error) {
      if (error.code === "23505") {
        let updateQuery = this.operationsDb()
          .from("automation_job_settings")
          .update({
            enabled: input.enabled,
            cron_schedule: input.cronSchedule,
            dry_run_only: input.dryRunOnly ?? false,
            config: input.config ?? {},
            updated_by: input.actorUserId ?? null,
          })
          .eq("organization_id", input.organizationId)
          .eq("job_name", input.jobName)

        updateQuery = input.hostelId
          ? updateQuery.eq("hostel_id", input.hostelId)
          : updateQuery.is("hostel_id", null)

        const { data: updated, error: updateError } = await updateQuery
          .select("*")
          .single()

        if (updateError) {
          throwRepositoryError(updateError, "Unable to update automation setting.")
        }

        return updated as Record<string, unknown>
      }

      throwRepositoryError(error, "Unable to save automation setting.")
    }

    return data as Record<string, unknown>
  }

  async createAuditLog(values: TablesInsert<"audit_logs">) {
    const { data, error } = await this.operationsDb()
      .from("audit_logs")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to write operations audit log.")
    }

    return data
  }

  async recalculateHostelCapacity(input: {
    organizationId: string
    hostelId: string
  }) {
    const { data, error } = await this.operationsDb().rpc("recalculate_hostel_capacity", {
      p_organization_id: input.organizationId,
      p_hostel_id: input.hostelId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to recalculate hostel capacity.")
    }

    return data
  }

  async repairOccupancyConsistency(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
  }) {
    const { data, error } = await this.operationsDb().rpc(
      "repair_occupancy_consistency_atomic",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_actor_user_id: input.actorUserId ?? null,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to repair occupancy consistency.")
    }

    return data as {
      invalidAllocationsRepaired?: number
      duplicateAllocationsRepaired?: number
      hostelsRecalculated?: number
    } | null
  }

  async repairTenantLinkageConsistency(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
  }) {
    const { data, error } = await this.operationsDb().rpc(
      "repair_tenant_linkage_consistency_atomic",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_actor_user_id: input.actorUserId ?? null,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to repair tenant linkage consistency.")
    }

    return data as {
      roomAllocationsRepaired?: number
      monthlyFeeRecordsRepaired?: number
      invoicesRepaired?: number
      paymentsRepaired?: number
      residentInvitesRepaired?: number
      reservationsRepaired?: number
      reservationPaymentsRepaired?: number
      documentsRepaired?: number
      hostelsRecalculated?: number
    } | null
  }

  async listResidentTenantIdentityAnomalies(input: {
    organizationId: string
    hostelId?: string | null
    limit?: number
  }) {
    const { data, error } = await this.operationsDb().rpc(
      "get_resident_tenant_identity_anomaly_report",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_limit: input.limit ?? 100,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to load resident tenant identity anomalies.")
    }

    return (data ?? []) as Array<Record<string, unknown>>
  }

  async repairOnboardingAccessConsistency(input: {
    organizationId: string
    hostelId?: string | null
    limit?: number
    actorUserId?: string | null
  }) {
    const { data, error } = await this.operationsDb().rpc(
      "repair_onboarding_access_consistency_atomic",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_limit: input.limit ?? 500,
        p_actor_user_id: input.actorUserId ?? null,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to repair onboarding access consistency.")
    }

    return data as {
      expiredCount?: number
      activatedInvitesRevokedCount?: number
      duplicateInvitesRevokedCount?: number
      authProfilesSyncedCount?: number
      deadlockResidentsAdvancedCount?: number
    } | null
  }

  async repairResidentLifecycle(input: {
    organizationId: string
    residentId: string
    actorUserId?: string | null
    dryRun?: boolean
  }) {
    const { data, error } = await this.operationsDb().rpc(
      "repair_resident_lifecycle_atomic",
      {
        p_organization_id: input.organizationId,
        p_resident_id: input.residentId,
        p_actor_user_id: input.actorUserId ?? null,
        p_dry_run: input.dryRun ?? true,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to repair resident lifecycle.")
    }

    return data as ResidentLifecycleRepairResult
  }

  async reconcileInvalidDues(input: {
    organizationId: string
    hostelId?: string | null
    limit?: number
    actorUserId?: string | null
  }) {
    const { data, error } = await this.operationsDb().rpc(
      "reconcile_invalid_dues_atomic",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_limit: input.limit ?? 500,
        p_actor_user_id: input.actorUserId ?? null,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to reconcile invalid dues.")
    }

    return data as {
      feeRecordsCancelled?: number
      invoicesCancelled?: number
    } | null
  }

  async repairAnalyticsConsistency(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
  }) {
    const { data, error } = await this.operationsDb().rpc(
      "repair_analytics_consistency_atomic",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_actor_user_id: input.actorUserId ?? null,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to repair analytics consistency.")
    }

    return data as { hostelsRecalculated?: number } | null
  }

  private operationsDb() {
    return this.db as unknown as GenericOperationsDb
  }
}
