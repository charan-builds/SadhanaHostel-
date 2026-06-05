import type { Json } from "@/types/database"

import type { PaymentRow } from "./payments.repository"
import { throwRepositoryError, type AppSupabaseClient } from "./types"

export type FinancialReconciliationCounts = {
  verified_payments_missing_invoice: number
  verified_payments_missing_receipt: number
  paid_zero_balance_fee_records_missing_invoice: number
  verified_receipt_documents_missing_invoice_link: number
  paid_invoice_payment_total_mismatch: number
}

export type MonthlyFeeInvoiceRepairResult = {
  dryRun: boolean
  candidates: number
  invoicesCreated: number
  paymentsLinked: number
}

export type AdvancePaymentInvoiceRepairResult = {
  dryRun: boolean
  candidates: number
  invoicesCreated: number
  paymentsLinked: number
}

export type ReceiptInvoiceLinkRepairResult = {
  dryRun: boolean
  candidates: number
  documentsLinked: number
}

type FinancialRpcName =
  | "financial_reconciliation_counts"
  | "list_verified_payments_missing_receipts"
  | "repair_monthly_fee_invoices_atomic"
  | "repair_advance_payment_invoices_atomic"
  | "repair_receipt_invoice_links_atomic"

type FinancialRpcClient = {
  rpc(
    fn: FinancialRpcName,
    args: Record<string, unknown>
  ): Promise<{ data: Json | null; error: unknown | null }>
}

export class FinancialReconciliationRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async getCounts(input: {
    organizationId: string
    hostelId?: string | null
  }): Promise<FinancialReconciliationCounts> {
    const { data, error } = await this.financialDb().rpc("financial_reconciliation_counts", {
      p_organization_id: input.organizationId,
      p_hostel_id: input.hostelId ?? null,
    })

    if (error) {
      throwRepositoryError(error as never, "Unable to load financial reconciliation counts.")
    }

    return normalizeCounts(data)
  }

  async repairMonthlyFeeInvoices(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
    dryRun: boolean
  }): Promise<MonthlyFeeInvoiceRepairResult> {
    const { data, error } = await this.financialDb().rpc("repair_monthly_fee_invoices_atomic", {
      p_organization_id: input.organizationId,
      p_hostel_id: input.hostelId ?? null,
      p_actor_user_id: input.actorUserId ?? null,
      p_dry_run: input.dryRun,
    })

    if (error) {
      throwRepositoryError(error as never, "Unable to repair monthly fee invoices.")
    }

    return normalizeMonthlyFeeRepair(data, input.dryRun)
  }

  async listVerifiedPaymentsMissingReceipts(input: {
    organizationId: string
    hostelId?: string | null
    limit?: number
  }): Promise<PaymentRow[]> {
    const { data, error } = await this.financialDb().rpc(
      "list_verified_payments_missing_receipts",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_limit: input.limit ?? 100,
      }
    )

    if (error) {
      throwRepositoryError(error as never, "Unable to list verified payments missing receipts.")
    }

    return Array.isArray(data) ? (data as PaymentRow[]) : []
  }

  async repairAdvancePaymentInvoices(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
    dryRun: boolean
  }): Promise<AdvancePaymentInvoiceRepairResult> {
    const { data, error } = await this.financialDb().rpc(
      "repair_advance_payment_invoices_atomic",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_actor_user_id: input.actorUserId ?? null,
        p_dry_run: input.dryRun,
      }
    )

    if (error) {
      throwRepositoryError(error as never, "Unable to repair advance payment invoices.")
    }

    return normalizeAdvanceRepair(data, input.dryRun)
  }

  async repairReceiptInvoiceLinks(input: {
    organizationId: string
    hostelId?: string | null
    actorUserId?: string | null
    dryRun: boolean
  }): Promise<ReceiptInvoiceLinkRepairResult> {
    const { data, error } = await this.financialDb().rpc(
      "repair_receipt_invoice_links_atomic",
      {
        p_organization_id: input.organizationId,
        p_hostel_id: input.hostelId ?? null,
        p_actor_user_id: input.actorUserId ?? null,
        p_dry_run: input.dryRun,
      }
    )

    if (error) {
      throwRepositoryError(error as never, "Unable to repair receipt invoice links.")
    }

    return normalizeReceiptRepair(data, input.dryRun)
  }

  private financialDb() {
    return this.db as unknown as FinancialRpcClient
  }
}

function normalizeCounts(value: Json | null): FinancialReconciliationCounts {
  const record = toRecord(value)

  return {
    verified_payments_missing_invoice: toCount(record.verified_payments_missing_invoice),
    verified_payments_missing_receipt: toCount(record.verified_payments_missing_receipt),
    paid_zero_balance_fee_records_missing_invoice: toCount(
      record.paid_zero_balance_fee_records_missing_invoice
    ),
    verified_receipt_documents_missing_invoice_link: toCount(
      record.verified_receipt_documents_missing_invoice_link
    ),
    paid_invoice_payment_total_mismatch: toCount(record.paid_invoice_payment_total_mismatch),
  }
}

function normalizeMonthlyFeeRepair(
  value: Json | null,
  dryRun: boolean
): MonthlyFeeInvoiceRepairResult {
  const record = toRecord(value)

  return {
    dryRun: toBoolean(record.dryRun, dryRun),
    candidates: toCount(record.candidates),
    invoicesCreated: toCount(record.invoicesCreated),
    paymentsLinked: toCount(record.paymentsLinked),
  }
}

function normalizeAdvanceRepair(
  value: Json | null,
  dryRun: boolean
): AdvancePaymentInvoiceRepairResult {
  const record = toRecord(value)

  return {
    dryRun: toBoolean(record.dryRun, dryRun),
    candidates: toCount(record.candidates),
    invoicesCreated: toCount(record.invoicesCreated),
    paymentsLinked: toCount(record.paymentsLinked),
  }
}

function normalizeReceiptRepair(
  value: Json | null,
  dryRun: boolean
): ReceiptInvoiceLinkRepairResult {
  const record = toRecord(value)

  return {
    dryRun: toBoolean(record.dryRun, dryRun),
    candidates: toCount(record.candidates),
    documentsLinked: toCount(record.documentsLinked),
  }
}

function toRecord(value: Json | null): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}
}

function toCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}
