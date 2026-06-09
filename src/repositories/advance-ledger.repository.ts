import type { PostgrestError } from "@supabase/supabase-js"

import type { Json, Tables } from "@/types/database"
import type {
  AdvanceFeeRecord,
  AdvancePaymentAllocationRow,
  AdvancePaymentDepositRow,
  AdvancePaymentMode,
  AdvancePaymentRefundRow,
  AdvanceRefundAuditLogRow,
} from "@/types/advance-ledger"

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
  is(column: string, value: boolean | null): GenericQueryBuilder
  in(column: string, values: unknown[]): GenericQueryBuilder
  gte(column: string, value: unknown): GenericQueryBuilder
  lte(column: string, value: unknown): GenericQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericQueryBuilder
  limit(count: number): GenericQueryBuilder
  range(from: number, to: number): Promise<QueryResult<unknown[]>>
  maybeSingle(): Promise<QueryResult<unknown>>
  single(): Promise<QueryResult<unknown>>
}

type GenericAdvanceDb = {
  from(table: string): GenericQueryBuilder
}

export type VerifiedAdvancePaymentRow = Pick<
  Tables<"payments">,
  | "id"
  | "organization_id"
  | "hostel_id"
  | "resident_id"
  | "amount"
  | "method"
  | "transaction_id"
  | "manual_reference"
  | "paid_at"
  | "verified_at"
  | "received_by"
  | "notes"
  | "created_by"
  | "updated_by"
>

export class AdvanceLedgerRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async listResidents(organizationId: string, hostelId?: string | null) {
    let query = this.typedDb()
      .from("residents")
      .select("id,full_name,hostel_id,monthly_fee_amount,joined_on,status,checkout_on")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load advance ledger residents.")
    }

    return (data ?? []) as Array<{
      id: string
      full_name: string
      hostel_id: string
      monthly_fee_amount: number
      joined_on: string | null
      status: string | null
      checkout_on: string | null
    }>
  }

  async listVerifiedAdvancePayments(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
  }) {
    let query = this.db
      .from("payments")
      .select(
        "id,organization_id,hostel_id,resident_id,amount,method,transaction_id,manual_reference,paid_at,verified_at,received_by,notes,created_by,updated_by"
      )
      .eq("organization_id", input.organizationId)
      .eq("status", "verified")
      .eq("is_advance", true)
      .is("deleted_at", null)
      .order("verified_at", { ascending: true })

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load verified advance payments.")
    }

    return (data ?? []) as VerifiedAdvancePaymentRow[]
  }

  async findDepositByPaymentId(organizationId: string, paymentId: string) {
    const { data, error } = await this.typedDb()
      .from("advance_payment_deposits")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("payment_id", paymentId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load advance deposit by payment.")
    }

    return data as AdvancePaymentDepositRow | null
  }

  async createDeposit(values: {
    organization_id: string
    hostel_id: string
    resident_id: string
    payment_id?: string | null
    amount: number
    payment_mode: AdvancePaymentMode
    transaction_id?: string | null
    received_date: string
    received_by?: string | null
    notes?: string | null
    status?: "received" | "voided"
    metadata?: Json
    created_by?: string | null
    updated_by?: string | null
  }) {
    const { data, error } = await this.typedDb()
      .from("advance_payment_deposits")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create advance deposit.")
    }

    return data as AdvancePaymentDepositRow
  }

  async listDeposits(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
  }) {
    let query = this.typedDb()
      .from("advance_payment_deposits")
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("received_date", { ascending: false })

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load advance deposits.")
    }

    return (data ?? []) as AdvancePaymentDepositRow[]
  }

  async listAllocations(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
  }) {
    let query = this.typedDb()
      .from("advance_payment_allocations")
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("period_month", { ascending: true })

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load advance allocations.")
    }

    return (data ?? []) as AdvancePaymentAllocationRow[]
  }

  async createAllocation(values: {
    organization_id: string
    hostel_id: string
    resident_id: string
    deposit_id?: string | null
    monthly_fee_record_id: string
    period_month: string
    amount: number
    allocated_by?: string | null
    metadata?: Json
    created_by?: string | null
    updated_by?: string | null
  }) {
    const { data, error } = await this.typedDb()
      .from("advance_payment_allocations")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create advance allocation.")
    }

    return data as AdvancePaymentAllocationRow
  }

  async listOpenFeeRecords(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
  }) {
    let query = this.db
      .from("monthly_fee_records")
      .select(
        "id,organization_id,hostel_id,resident_id,period_month,due_date,total_amount,paid_amount,balance_amount,advance_adjustment_amount,status"
      )
      .eq("organization_id", input.organizationId)
      .in("status", ["pending", "partial", "overdue"])
      .is("deleted_at", null)
      .order("period_month", { ascending: true })

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load open monthly fee records.")
    }

    return (data ?? []) as AdvanceFeeRecord[]
  }

  async updateFeeRecordForAdvanceAllocation(input: {
    organizationId: string
    feeRecord: AdvanceFeeRecord
    allocationAmount: number
    actorUserId: string | null
  }) {
    const paidAmount = Math.min(
      input.feeRecord.total_amount,
      input.feeRecord.paid_amount + input.allocationAmount
    )
    const balanceAmount = Math.max(0, input.feeRecord.total_amount - paidAmount)
    const { data, error } = await this.db
      .from("monthly_fee_records")
      .update({
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        advance_adjustment_amount:
          input.feeRecord.advance_adjustment_amount + input.allocationAmount,
        status: balanceAmount === 0 ? "paid" : "partial",
        updated_by: input.actorUserId,
      })
      .eq("id", input.feeRecord.id)
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update monthly fee record for advance.")
    }

    return data
  }

  async updateInvoicesForAdvanceAllocation(input: {
    organizationId: string
    monthlyFeeRecordId: string
    allocationAmount: number
    actorUserId: string | null
  }) {
    const { data: invoices, error: loadError } = await this.db
      .from("invoices")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("monthly_fee_record_id", input.monthlyFeeRecordId)
      .is("deleted_at", null)

    if (loadError) {
      throwRepositoryError(loadError, "Unable to load invoices for advance allocation.")
    }

    for (const invoice of invoices ?? []) {
      const paidAmount = Math.min(invoice.total_amount, invoice.paid_amount + input.allocationAmount)
      const balanceAmount = Math.max(0, invoice.total_amount - paidAmount)
      const { error } = await this.db
        .from("invoices")
        .update({
          paid_amount: paidAmount,
          balance_amount: balanceAmount,
          status: balanceAmount === 0 ? "paid" : "partially_paid",
          updated_by: input.actorUserId,
        })
        .eq("id", invoice.id)
        .eq("organization_id", input.organizationId)
        .is("deleted_at", null)

      if (error) {
        throwRepositoryError(error, "Unable to update invoice for advance allocation.")
      }
    }

    return invoices?.length ?? 0
  }

  async listRefunds(input: {
    organizationId: string
    hostelId?: string | null
    residentId?: string | null
  }) {
    let query = this.typedDb()
      .from("advance_payment_refunds")
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    const { data, error } = await query.range(0, 50_000)

    if (error) {
      throwRepositoryError(error, "Unable to load advance refunds.")
    }

    return (data ?? []) as AdvancePaymentRefundRow[]
  }

  async getRefund(organizationId: string, refundId: string) {
    const { data, error } = await this.typedDb()
      .from("advance_payment_refunds")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", refundId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load advance refund.")
    }

    return data as AdvancePaymentRefundRow | null
  }

  async createRefund(values: {
    organization_id: string
    hostel_id: string
    resident_id: string
    amount: number
    reason: string
    requested_by?: string | null
    notes?: string | null
    metadata?: Json
    created_by?: string | null
    updated_by?: string | null
  }) {
    const { data, error } = await this.typedDb()
      .from("advance_payment_refunds")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create advance refund request.")
    }

    return data as AdvancePaymentRefundRow
  }

  async updateRefund(input: {
    organizationId: string
    refundId: string
    values: Record<string, unknown>
  }) {
    const { data, error } = await this.typedDb()
      .from("advance_payment_refunds")
      .update(input.values)
      .eq("organization_id", input.organizationId)
      .eq("id", input.refundId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update advance refund.")
    }

    return data as AdvancePaymentRefundRow
  }

  async createRefundAudit(values: {
    organization_id: string
    hostel_id?: string | null
    resident_id?: string | null
    refund_id: string
    actor_user_id?: string | null
    action: string
    old_status?: string | null
    new_status?: string | null
    notes?: string | null
    metadata?: Json
  }) {
    const { data, error } = await this.typedDb()
      .from("advance_payment_refund_audit_logs")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create advance refund audit log.")
    }

    return data as AdvanceRefundAuditLogRow
  }

  private typedDb() {
    return this.db as unknown as GenericAdvanceDb
  }
}
