import type { PostgrestError } from "@supabase/supabase-js"

import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"

import {
  createPaginationMeta,
  normalizePagination,
  throwRepositoryError,
  type AppSupabaseClient,
  type PaginatedResult,
  type PaginationParams,
} from "./types"

export type PaymentRow = Tables<"payments">
export type MonthlyFeeRecordRow = Tables<"monthly_fee_records">
export type PaymentStatus = Database["public"]["Enums"]["payment_status_enum"]
export type PaymentMethod = Database["public"]["Enums"]["payment_method_enum"]
export type FeeRecordStatus = Database["public"]["Enums"]["fee_record_status_enum"]

export type ListPaymentsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  residentId?: string
  status?: PaymentStatus
  method?: PaymentMethod
  fromDate?: string
  toDate?: string
}

export type ListFeeRecordsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  residentId?: string
  status?: FeeRecordStatus
  periodMonth?: string
}

export class PaymentsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async list(filters: ListPaymentsFilters): Promise<PaginatedResult<PaymentRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("payments")
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

    if (filters.method) {
      query = query.eq("method", filters.method)
    }

    if (filters.fromDate) {
      query = query.gte("created_at", filters.fromDate)
    }

    if (filters.toDate) {
      query = query.lte("created_at", filters.toDate)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list payments.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async getById(paymentId: string, organizationId?: string) {
    let query = this.db
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .is("deleted_at", null)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load payment.")
    }

    return data
  }

  async create(values: TablesInsert<"payments">) {
    const { data, error } = await this.db
      .from("payments")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create payment.")
    }

    return data
  }

  async findByIdempotencyKey(organizationId: string, idempotencyKey: string) {
    const { data, error } = await this.db
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("idempotency_key", idempotencyKey)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load idempotent payment.")
    }

    return data
  }

  async verify(
    paymentId: string,
    organizationId: string,
    verifierUserId: string,
    idempotencyKey?: string
  ) {
    const rpc = this.db as unknown as VerifyPaymentRpcClient
    const { data, error } = await rpc.rpc("verify_payment_atomic", {
      p_payment_id: paymentId,
      p_organization_id: organizationId,
      p_verifier_user_id: verifierUserId,
      p_idempotency_key: idempotencyKey ?? null,
    })

    if (error) {
      throwRepositoryError(error, "Unable to verify payment.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to verify payment.")
    }

    return data
  }

  async listFeeRecords(
    filters: ListFeeRecordsFilters
  ): Promise<PaginatedResult<MonthlyFeeRecordRow>> {
    const { page, pageSize, from, to } = normalizePagination(filters)

    let query = this.db
      .from("monthly_fee_records")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order("period_month", { ascending: false })

    if (filters.hostelId) {
      query = query.eq("hostel_id", filters.hostelId)
    }

    if (filters.residentId) {
      query = query.eq("resident_id", filters.residentId)
    }

    if (filters.status) {
      query = query.eq("status", filters.status)
    }

    if (filters.periodMonth) {
      query = query.eq("period_month", filters.periodMonth)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      throwRepositoryError(error, "Unable to list fee records.")
    }

    return {
      data: data ?? [],
      meta: createPaginationMeta(count, page, pageSize),
    }
  }

  async createFeeRecord(values: TablesInsert<"monthly_fee_records">) {
    const { data, error } = await this.db
      .from("monthly_fee_records")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create monthly fee record.")
    }

    return data
  }

  async findFeeRecordByResidentPeriod(
    organizationId: string,
    residentId: string,
    periodMonth: string
  ) {
    const { data, error } = await this.db
      .from("monthly_fee_records")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("resident_id", residentId)
      .eq("period_month", periodMonth)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load monthly fee record.")
    }

    return data
  }

  async listDueFeeRecords(organizationId: string, dueBeforeDate: string, limit = 100) {
    const { data, error } = await this.db
      .from("monthly_fee_records")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "partial", "overdue"])
      .lte("due_date", dueBeforeDate)
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .limit(limit)

    if (error) {
      throwRepositoryError(error, "Unable to load due fee records.")
    }

    return data ?? []
  }

  async updateFeeRecord(
    feeRecordId: string,
    organizationId: string,
    values: TablesUpdate<"monthly_fee_records">
  ) {
    const { data, error } = await this.db
      .from("monthly_fee_records")
      .update(values)
      .eq("id", feeRecordId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update monthly fee record.")
    }

    return data
  }

  async listResidentPayments(
    organizationId: string,
    residentId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<PaymentRow>> {
    return this.list({
      ...params,
      organizationId,
      residentId,
    })
  }
}

type VerifyPaymentRpcClient = {
  rpc(
    fn: "verify_payment_atomic",
    args: {
      p_payment_id: string
      p_organization_id: string
      p_verifier_user_id: string
      p_idempotency_key: string | null
    }
  ): Promise<{ data: PaymentRow | null; error: PostgrestError | null }>
}
