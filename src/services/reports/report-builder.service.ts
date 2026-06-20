import "server-only"

import { normalizeDateRange } from "@/lib/date-range"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/repositories/types"
import { throwRepositoryError } from "@/repositories/types"
import {
  reportRequestSchema,
  reportTypeSchema,
  type ParsedReportRequest,
  type ReportType,
} from "@/validations/report.validation"

import { AuthService } from "../auth.service"
import type { ReportColumn, ReportDefinition, ReportRow } from "./types"

const PAGE_SIZE = 500

const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  payments: [
    { key: "row_type", label: "Row Type" },
    { key: "date_basis", label: "Date Basis" },
    { key: "created_at", label: "Created At" },
    { key: "resident_id", label: "Resident ID" },
    { key: "amount", label: "Amount" },
    { key: "method", label: "Method" },
    { key: "status", label: "Status" },
    { key: "transaction_id", label: "Transaction ID" },
    { key: "verified_at", label: "Verified At" },
    { key: "invoice_id", label: "Invoice ID" },
    { key: "monthly_fee_record_id", label: "Monthly Fee Record ID" },
    { key: "is_advance", label: "Advance" },
  ],
  monthly_fees: [
    { key: "row_type", label: "Row Type" },
    { key: "period_month", label: "Period Month" },
    { key: "due_date", label: "Due Date" },
    { key: "resident_id", label: "Resident ID" },
    { key: "base_amount", label: "Base Amount" },
    { key: "discount_amount", label: "Discount" },
    { key: "penalty_amount", label: "Penalty" },
    { key: "adjustment_amount", label: "Adjustment" },
    { key: "advance_adjustment_amount", label: "Advance Adjustment" },
    { key: "total_amount", label: "Total Amount" },
    { key: "paid_amount", label: "Paid Amount" },
    { key: "balance_amount", label: "Balance Amount" },
    { key: "status", label: "Status" },
  ],
  invoices: [
    { key: "row_type", label: "Row Type" },
    { key: "issue_date", label: "Issue Date" },
    { key: "due_date", label: "Due Date" },
    { key: "invoice_number", label: "Invoice Number" },
    { key: "resident_id", label: "Resident ID" },
    { key: "monthly_fee_record_id", label: "Monthly Fee Record ID" },
    { key: "subtotal_amount", label: "Subtotal" },
    { key: "discount_amount", label: "Discount" },
    { key: "tax_amount", label: "Tax" },
    { key: "total_amount", label: "Total Amount" },
    { key: "paid_amount", label: "Paid Amount" },
    { key: "balance_amount", label: "Balance Amount" },
    { key: "status", label: "Status" },
    { key: "pdf_document_id", label: "PDF Document ID" },
  ],
  residents: [
    { key: "admission_number", label: "Admission Number" },
    { key: "full_name", label: "Full Name" },
    { key: "resident_type", label: "Resident Type" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "monthly_fee_amount", label: "Monthly Fee" },
    { key: "joined_on", label: "Joined On" },
  ],
  leaves: [
    { key: "created_at", label: "Created At" },
    { key: "resident_id", label: "Resident ID" },
    { key: "from_date", label: "From" },
    { key: "to_date", label: "To" },
    { key: "status", label: "Status" },
    { key: "travel_mode", label: "Travel Mode" },
    { key: "destination", label: "Destination" },
  ],
}

export class ReportBuilderService {
  private readonly authService: AuthService

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new ReportBuilderService(db)
  }

  async build(typeInput: unknown, input: unknown): Promise<ReportDefinition> {
    const type = reportTypeSchema.parse(typeInput)
    const values = reportRequestSchema.parse(input)
    const context = await this.authService.requirePermission("reports.export")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const scopedValues = {
      ...values,
      ...(hostelId ? { hostelId } : {}),
    }

    return {
      fileName: this.fileName(type, scopedValues),
      columns: REPORT_COLUMNS[type],
      rows: this.rowsFor(type, scopedValues),
    }
  }

  private rowsFor(type: ReportType, values: ParsedReportRequest): AsyncIterable<ReportRow> {
    switch (type) {
      case "payments":
        return this.paymentRows(values)
      case "monthly_fees":
        return this.monthlyFeeRows(values)
      case "invoices":
        return this.invoiceRows(values)
      case "residents":
        return this.residentRows(values)
      case "leaves":
        return this.leaveRows(values)
    }
  }

  private async *paymentRows(values: ParsedReportRequest): AsyncIterable<ReportRow> {
    let emitted = 0
    let totalAmount = 0
    const dateColumn = values.dateBasis === "activity" ? "created_at" : "verified_at"
    const range = normalizeDateRange(values)

    while (emitted < values.maxRows) {
      let query = this.db
        .from("payments")
        .select("created_at,resident_id,amount,method,status,transaction_id,verified_at,invoice_id,monthly_fee_record_id,is_advance")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order(dateColumn, { ascending: false })

      if (values.dateBasis === "revenue") {
        query = query
          .eq("status", "verified")
          .not("verified_at", "is", null)
      }
      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (range.fromDate) query = query.gte(dateColumn, range.fromDate)
      if (range.toDate) query = query.lte(dateColumn, range.toDate)

      const { data, error } = await query.range(
        emitted,
        Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1)
      )
      if (error) throwRepositoryError(error, "Unable to export payment report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        totalAmount += Number(row.amount ?? 0)
        yield {
          row_type: "DETAIL",
          date_basis: values.dateBasis,
          ...row,
        }
      }
    }

    yield {
      row_type: "TOTAL",
      date_basis: values.dateBasis,
      amount: Number(totalAmount.toFixed(2)),
    }
  }

  private async *monthlyFeeRows(values: ParsedReportRequest): AsyncIterable<ReportRow> {
    let emitted = 0
    let totalAmount = 0
    let paidAmount = 0
    let balanceAmount = 0

    while (emitted < values.maxRows) {
      let query = this.db
        .from("monthly_fee_records")
        .select("period_month,due_date,resident_id,base_amount,discount_amount,penalty_amount,adjustment_amount,advance_adjustment_amount,total_amount,paid_amount,balance_amount,status")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order("period_month", { ascending: false })

      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (values.fromDate) query = query.gte("period_month", values.fromDate)
      if (values.toDate) query = query.lte("period_month", values.toDate)

      const { data, error } = await query.range(
        emitted,
        Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1)
      )
      if (error) throwRepositoryError(error, "Unable to export monthly fee report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        totalAmount += Number(row.total_amount ?? 0)
        paidAmount += Number(row.paid_amount ?? 0)
        balanceAmount += Number(row.balance_amount ?? 0)
        yield {
          row_type: "DETAIL",
          ...row,
        }
      }
    }

    yield {
      row_type: "TOTAL",
      total_amount: Number(totalAmount.toFixed(2)),
      paid_amount: Number(paidAmount.toFixed(2)),
      balance_amount: Number(balanceAmount.toFixed(2)),
    }
  }

  private async *invoiceRows(values: ParsedReportRequest): AsyncIterable<ReportRow> {
    let emitted = 0
    let totalAmount = 0
    let paidAmount = 0
    let balanceAmount = 0

    while (emitted < values.maxRows) {
      let query = this.db
        .from("invoices")
        .select("issue_date,due_date,invoice_number,resident_id,monthly_fee_record_id,subtotal_amount,discount_amount,tax_amount,total_amount,paid_amount,balance_amount,status,pdf_document_id")
        .eq("organization_id", values.organizationId)
        .not("monthly_fee_record_id", "is", null)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false })

      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (values.fromDate) query = query.gte("issue_date", values.fromDate)
      if (values.toDate) query = query.lte("issue_date", values.toDate)

      const { data, error } = await query.range(
        emitted,
        Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1)
      )
      if (error) throwRepositoryError(error, "Unable to export invoice report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        totalAmount += Number(row.total_amount ?? 0)
        paidAmount += Number(row.paid_amount ?? 0)
        balanceAmount += Number(row.balance_amount ?? 0)
        yield {
          row_type: "DETAIL",
          ...row,
        }
      }
    }

    yield {
      row_type: "TOTAL",
      total_amount: Number(totalAmount.toFixed(2)),
      paid_amount: Number(paidAmount.toFixed(2)),
      balance_amount: Number(balanceAmount.toFixed(2)),
    }
  }

  private async *residentRows(values: ParsedReportRequest): AsyncIterable<ReportRow> {
    let emitted = 0
    const range = normalizeDateRange(values)

    while (emitted < values.maxRows) {
      let query = this.db
        .from("residents")
        .select("admission_number,full_name,resident_type,phone,email,status,monthly_fee_amount,joined_on")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (range.fromDate) query = query.gte("created_at", range.fromDate)
      if (range.toDate) query = query.lte("created_at", range.toDate)

      const { data, error } = await query.range(
        emitted,
        Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1)
      )
      if (error) throwRepositoryError(error, "Unable to export resident report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        yield row
      }
    }
  }

  private async *leaveRows(values: ParsedReportRequest): AsyncIterable<ReportRow> {
    let emitted = 0
    const range = normalizeDateRange(values)

    while (emitted < values.maxRows) {
      let query = this.db
        .from("leave_requests")
        .select("created_at,resident_id,from_date,to_date,status,travel_mode,destination")
        .eq("organization_id", values.organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (values.hostelId) query = query.eq("hostel_id", values.hostelId)
      if (range.fromDate) query = query.gte("created_at", range.fromDate)
      if (range.toDate) query = query.lte("created_at", range.toDate)

      const { data, error } = await query.range(
        emitted,
        Math.min(emitted + PAGE_SIZE - 1, values.maxRows - 1)
      )
      if (error) throwRepositoryError(error, "Unable to export leave report.")
      if (!data?.length) break

      for (const row of data) {
        emitted += 1
        yield row
      }
    }
  }

  private fileName(type: ReportType, values: ParsedReportRequest) {
    const date = new Date().toISOString().slice(0, 10)
    const hostelScope = values.hostelId ? `-${values.hostelId.slice(0, 8)}` : ""

    return `${type}${hostelScope}-${date}`
  }
}
