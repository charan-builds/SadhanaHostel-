import type { PostgrestError } from "@supabase/supabase-js"

import { normalizeDateRange } from "@/lib/date-range"
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
export type InvoiceFinalizationStatus =
  Database["public"]["Enums"]["invoice_finalization_status_enum"]

type AdvanceBalanceQuery = {
  select(columns: string): AdvanceBalanceQuery
  eq(column: string, value: unknown): AdvanceBalanceQuery
  maybeSingle(): Promise<{
    data: { remaining_advance_balance: number } | null
    error: PostgrestError | null
  }>
}

type AdvanceBalanceDb = {
  from(table: "advance_balance_view"): AdvanceBalanceQuery
}

export type ListPaymentsFilters = PaginationParams & {
  organizationId: string
  hostelId?: string
  residentId?: string
  status?: PaymentStatus
  method?: PaymentMethod
  isAdvance?: boolean
  fromDate?: string
  toDate?: string
  dateBasis?: "activity" | "revenue"
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
    const dateColumn = filters.dateBasis === "revenue" ? "verified_at" : "created_at"
    const range = normalizeDateRange(filters)

    let query = this.db
      .from("payments")
      .select("*", { count: "exact" })
      .eq("organization_id", filters.organizationId)
      .is("deleted_at", null)
      .order(dateColumn, { ascending: false })

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

    if (filters.isAdvance !== undefined) {
      query = query.eq("is_advance", filters.isAdvance)
    }

    if (filters.dateBasis === "revenue") {
      query = query
        .eq("status", "verified")
        .eq("is_advance", false)
        .not("verified_at", "is", null)
    }

    if (range.fromDate) {
      query = query.gte(dateColumn, range.fromDate)
    }

    if (range.toDate) {
      query = query.lte(dateColumn, range.toDate)
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

  async createResidentUpiDraft(values: {
    organizationId: string
    hostelId: string
    residentId: string
    monthlyFeeRecordId?: string | null
    amount: number
    transactionId: string
    idempotencyKey: string
    notes?: string | null
    isAdvance?: boolean
    isPartial?: boolean
    actorUserId: string
  }) {
    const rpc = this.db as unknown as PaymentDraftRpcClient
    const { data, error } = await rpc.rpc("create_resident_upi_payment_draft", {
      p_organization_id: values.organizationId,
      p_hostel_id: values.hostelId,
      p_resident_id: values.residentId,
      p_monthly_fee_record_id: values.monthlyFeeRecordId ?? null,
      p_amount: values.amount,
      p_transaction_id: values.transactionId,
      p_idempotency_key: values.idempotencyKey,
      p_notes: values.notes ?? null,
      p_is_advance: values.isAdvance ?? false,
      p_is_partial: values.isPartial ?? false,
      p_actor_user_id: values.actorUserId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to create UPI payment draft.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to create UPI payment draft.")
    }

    return data
  }

  async finalizeSubmission(
    paymentId: string,
    organizationId: string,
    proofDocumentId: string,
    actorUserId: string
  ) {
    const rpc = this.db as unknown as PaymentFinalizeRpcClient
    const { data, error } = await rpc.rpc("finalize_payment_submission", {
      p_payment_id: paymentId,
      p_organization_id: organizationId,
      p_proof_document_id: proofDocumentId,
      p_actor_user_id: actorUserId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to finalize payment submission.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to finalize payment submission.")
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

  async listVerifiedPaymentsMissingInvoices(organizationId: string, hostelId?: string) {
    let query = this.db
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "verified")
      .is("invoice_id", null)
      .is("deleted_at", null)
      .order("verified_at", { ascending: false })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.limit(500)

    if (error) {
      throwRepositoryError(error, "Unable to list verified payments missing invoices.")
    }

    return data ?? []
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

  async reject(
    paymentId: string,
    organizationId: string,
    reviewerUserId: string,
    reason: string
  ) {
    const rpc = this.db as unknown as RejectPaymentRpcClient
    const { data, error } = await rpc.rpc("reject_payment_atomic", {
      p_payment_id: paymentId,
      p_organization_id: organizationId,
      p_reviewer_user_id: reviewerUserId,
      p_reason: reason,
    })

    if (error) {
      throwRepositoryError(error, "Unable to reject payment.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to reject payment.")
    }

    return data
  }

  async updateInvoiceLink(
    paymentId: string,
    organizationId: string,
    invoiceId: string,
    actorUserId: string
  ) {
    const { data, error } = await this.db
      .from("payments")
      .update({
        invoice_id: invoiceId,
        updated_by: actorUserId,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to link payment invoice.")
    }

    return data
  }

  async markInvoiceFinalizationInProgress(
    paymentId: string,
    organizationId: string,
    actorUserId: string
  ) {
    const current = await this.getById(paymentId, organizationId)
    const { data, error } = await this.db
      .from("payments")
      .update({
        invoice_finalization_status: "in_progress",
        invoice_finalization_attempts:
          (current?.invoice_finalization_attempts ?? 0) + 1,
        invoice_finalization_error: null,
        updated_by: actorUserId,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .eq("status", "verified")
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to start payment invoice finalization.")
    }

    return data
  }

  async markInvoiceFinalizationSucceeded(
    paymentId: string,
    organizationId: string,
    actorUserId: string
  ) {
    const { data, error } = await this.db
      .from("payments")
      .update({
        invoice_finalization_status: "succeeded",
        invoice_finalization_error: null,
        invoice_finalized_at: new Date().toISOString(),
        updated_by: actorUserId,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .eq("status", "verified")
      .not("invoice_id", "is", null)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to complete payment invoice finalization.")
    }

    return data
  }

  async markInvoiceFinalizationFailed(
    paymentId: string,
    organizationId: string,
    errorMessage: string,
    actorUserId: string
  ) {
    const { data, error } = await this.db
      .from("payments")
      .update({
        invoice_finalization_status: "failed",
        invoice_finalization_error: errorMessage.slice(0, 1000),
        updated_by: actorUserId,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .eq("status", "verified")
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to mark payment invoice finalization failed.")
    }

    return data
  }

  async listPaymentsNeedingInvoiceFinalization(
    organizationId: string,
    hostelId?: string
  ) {
    let query = this.db
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "verified")
      .in("invoice_finalization_status", ["pending", "failed"])
      .is("deleted_at", null)
      .order("verified_at", { ascending: true })
      .limit(500)

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to list payments needing invoice finalization.")
    }

    return data ?? []
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

  async getFeeRecordById(
    organizationId: string,
    monthlyFeeRecordId: string
  ) {
    const { data, error } = await this.db
      .from("monthly_fee_records")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", monthlyFeeRecordId)
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
      isAdvance: false,
    })
  }

  async getResidentAdvanceBalance(organizationId: string, residentId: string) {
    const { data, error } = await (this.db as unknown as AdvanceBalanceDb)
      .from("advance_balance_view")
      .select("remaining_advance_balance")
      .eq("organization_id", organizationId)
      .eq("resident_id", residentId)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load resident advance balance.")
    }

    return Number(data?.remaining_advance_balance ?? 0)
  }

  async listResidentInvoices(
    organizationId: string,
    residentId: string,
    limit = 50
  ) {
    const { data, error } = await this.db
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("resident_id", residentId)
      .not("monthly_fee_record_id", "is", null)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(limit)

    if (error) {
      throwRepositoryError(error, "Unable to load resident invoices.")
    }

    return data ?? []
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

type PaymentDraftRpcClient = {
  rpc(
    fn: "create_resident_upi_payment_draft",
    args: {
      p_organization_id: string
      p_hostel_id: string
      p_resident_id: string
      p_monthly_fee_record_id: string | null
      p_amount: number
      p_transaction_id: string
      p_idempotency_key: string
      p_notes: string | null
      p_is_advance: boolean
      p_is_partial: boolean
      p_actor_user_id: string
    }
  ): Promise<{ data: PaymentRow | null; error: PostgrestError | null }>
}

type PaymentFinalizeRpcClient = {
  rpc(
    fn: "finalize_payment_submission",
    args: {
      p_payment_id: string
      p_organization_id: string
      p_proof_document_id: string
      p_actor_user_id: string
    }
  ): Promise<{ data: PaymentRow | null; error: PostgrestError | null }>
}

type RejectPaymentRpcClient = {
  rpc(
    fn: "reject_payment_atomic",
    args: {
      p_payment_id: string
      p_organization_id: string
      p_reviewer_user_id: string
      p_reason: string
    }
  ): Promise<{ data: PaymentRow | null; error: PostgrestError | null }>
}
