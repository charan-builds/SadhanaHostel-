import type { PostgrestError } from "@supabase/supabase-js"

import type { TablesInsert } from "@/types/database"
import type {
  ManualPaymentMethod,
  PaymentSettingRow,
} from "@/types/payment-operations"

import {
  throwRepositoryError,
  type AppSupabaseClient,
} from "./types"

type QueryResult<T> = {
  data: T | null
  error: PostgrestError | null
}

type GenericQueryBuilder = {
  select(columns?: string): GenericQueryBuilder
  insert(values: unknown): GenericQueryBuilder
  update(values: unknown): GenericQueryBuilder
  eq(column: string, value: unknown): GenericQueryBuilder
  is(column: string, value: boolean | null): GenericQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericQueryBuilder
  limit(count: number): GenericQueryBuilder
  maybeSingle(): Promise<QueryResult<unknown>>
  single(): Promise<QueryResult<unknown>>
  range(from: number, to: number): Promise<QueryResult<unknown[]>>
}

type PaymentSettingsDb = {
  from(table: "payment_settings" | "audit_logs"): GenericQueryBuilder
  rpc(
    functionName: "upsert_payment_setting_atomic",
    args: Record<string, unknown>
  ): Promise<QueryResult<unknown>>
}

export type UpsertPaymentSettingValues = {
  id?: string
  organizationId: string
  hostelId: string
  paymentMethod: ManualPaymentMethod
  accountName: string
  upiId?: string
  qrImagePath?: string
  bankName?: string
  branchName?: string
  accountLast4?: string
  isActive: boolean
  supportsManualVerification: boolean
  instructions?: string
  requireUtr: boolean
  requireScreenshot: boolean
  allowPartialPayment: boolean
  allowAdvancePayment: boolean
  autoExpirePendingPayments: boolean
  minPaymentAmount: number
  utrRegex: string
  duplicateDetectionStrictness: "standard" | "strict"
  rotate?: boolean
  rotatedFromSettingId?: string
  qrReplaced?: boolean
  actorUserId: string
}

export class PaymentSettingsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async getActive(organizationId: string, hostelId: string) {
    const { data, error } = await this.paymentSettingsDb()
      .from("payment_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("hostel_id", hostelId)
      .eq("is_active", true)
      .eq("supports_manual_verification", true)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load active payment settings.")
    }

    return data as PaymentSettingRow | null
  }

  async getById(organizationId: string, settingId: string) {
    const { data, error } = await this.paymentSettingsDb()
      .from("payment_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", settingId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load payment settings.")
    }

    return data as PaymentSettingRow | null
  }

  async list(organizationId: string, hostelId?: string) {
    let query = this.paymentSettingsDb()
      .from("payment_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false })

    if (hostelId) {
      query = query.eq("hostel_id", hostelId)
    }

    const { data, error } = await query.range(0, 100)

    if (error) {
      throwRepositoryError(error, "Unable to list payment settings.")
    }

    return (data ?? []) as PaymentSettingRow[]
  }

  async upsert(values: UpsertPaymentSettingValues) {
    const { data, error } = await this.paymentSettingsDb().rpc(
      "upsert_payment_setting_atomic",
      {
        p_id: values.id ?? null,
        p_organization_id: values.organizationId,
        p_hostel_id: values.hostelId,
        p_payment_method: values.paymentMethod,
        p_account_name: values.accountName,
        p_upi_id: values.upiId || null,
        p_qr_image_path: values.qrImagePath || null,
        p_bank_name: values.bankName || null,
        p_branch_name: values.branchName || null,
        p_account_last4: values.accountLast4 || null,
        p_is_active: values.isActive,
        p_supports_manual_verification: values.supportsManualVerification,
        p_instructions: values.instructions || null,
        p_actor_user_id: values.actorUserId,
        p_require_utr: values.requireUtr,
        p_require_screenshot: values.requireScreenshot,
        p_allow_partial_payment: values.allowPartialPayment,
        p_allow_advance_payment: values.allowAdvancePayment,
        p_auto_expire_pending_payments: values.autoExpirePendingPayments,
        p_min_payment_amount: values.minPaymentAmount,
        p_utr_regex: values.utrRegex,
        p_duplicate_detection_strictness: values.duplicateDetectionStrictness,
        p_rotated_from_setting_id: values.rotatedFromSettingId ?? null,
        p_qr_replaced: values.qrReplaced ?? false,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to save payment settings.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to save payment settings.")
    }

    return data as PaymentSettingRow
  }

  async createAuditLog(values: TablesInsert<"audit_logs">) {
    const { data, error } = await this.paymentSettingsDb()
      .from("audit_logs")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to record payment settings audit log.")
    }

    return data
  }

  private paymentSettingsDb() {
    return this.db as unknown as PaymentSettingsDb
  }
}
