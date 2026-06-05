import type { PostgrestError } from "@supabase/supabase-js"

import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"

import {
  throwRepositoryError,
  type AppSupabaseClient,
} from "./types"

export type InvoiceRow = Tables<"invoices">
export type OrganizationRow = Tables<"organizations">
export type HostelRow = Tables<"hostels">
export type ResidentRow = Tables<"residents">
export type MonthlyFeeRecordRow = Tables<"monthly_fee_records">
export type DocumentRow = Tables<"documents">

export class InvoicesRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async getOrganization(organizationId: string) {
    const { data, error } = await this.db
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load organization.")
    }

    return data
  }

  async getHostel(hostelId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("hostels")
      .select("*")
      .eq("id", hostelId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load hostel.")
    }

    return data
  }

  async getResident(residentId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("residents")
      .select("*")
      .eq("id", residentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load resident.")
    }

    return data
  }

  async getFeeRecord(feeRecordId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("monthly_fee_records")
      .select("*")
      .eq("id", feeRecordId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load monthly fee record.")
    }

    return data
  }

  async findByFeeRecord(monthlyFeeRecordId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("invoices")
      .select("*")
      .eq("monthly_fee_record_id", monthlyFeeRecordId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load existing invoice.")
    }

    return data
  }

  async getById(invoiceId: string, organizationId?: string) {
    let query = this.db
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .is("deleted_at", null)

    if (organizationId) {
      query = query.eq("organization_id", organizationId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load invoice.")
    }

    return data
  }

  async listMissingPdfInvoices(input: {
    organizationId: string
    hostelId?: string | null
    limit?: number
  }) {
    let query = this.db
      .from("invoices")
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("pdf_document_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(input.limit ?? 100)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query

    if (error) {
      throwRepositoryError(error, "Unable to load invoices missing PDFs.")
    }

    return data ?? []
  }

  async getPaymentById(paymentId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load invoice payment.")
    }

    return data
  }

  async findPaymentByInvoiceId(invoiceId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load payment linked to invoice.")
    }

    return data
  }

  async findReceiptByPaymentId(paymentId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .contains("metadata", { payment_id: paymentId })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load payment receipt invoice.")
    }

    return data
  }

  async countIssuedInvoicesForMonth(organizationId: string, issueMonth: string) {
    const start = `${issueMonth}-01`
    const end = new Date(`${start}T00:00:00.000Z`)
    end.setUTCMonth(end.getUTCMonth() + 1)

    const { count, error } = await this.db
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("issue_date", start)
      .lt("issue_date", end.toISOString().slice(0, 10))
      .is("deleted_at", null)

    if (error) {
      throwRepositoryError(error, "Unable to count invoices.")
    }

    return count ?? 0
  }

  async create(values: TablesInsert<"invoices">) {
    const { data, error } = await this.db
      .from("invoices")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create invoice.")
    }

    return data
  }

  async createMonthlyFeeInvoiceAtomic(
    organizationId: string,
    monthlyFeeRecordId: string,
    actorUserId: string
  ) {
    const rpc = this.db as unknown as CreateMonthlyFeeInvoiceAtomicRpcClient
    const { data, error } = await rpc.rpc("create_monthly_fee_invoice_atomic", {
      p_organization_id: organizationId,
      p_monthly_fee_record_id: monthlyFeeRecordId,
      p_actor_user_id: actorUserId,
    })

    if (error) {
      throwRepositoryError(error, "Unable to create invoice.")
    }

    if (!data) {
      throwRepositoryError(null, "Unable to create invoice.")
    }

    return data
  }

  async update(invoiceId: string, organizationId: string, values: TablesUpdate<"invoices">) {
    const { data, error } = await this.db
      .from("invoices")
      .update(values)
      .eq("id", invoiceId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update invoice.")
    }

    return data
  }

  async createDocument(values: TablesInsert<"documents">) {
    const { data, error } = await this.db
      .from("documents")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create invoice document.")
    }

    return data
  }

  async findInvoicePdfDocument(invoiceId: string, organizationId: string) {
    const { data, error } = await this.db
      .from("documents")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("organization_id", organizationId)
      .eq("document_type", "invoice_pdf")
      .eq("status", "verified")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load invoice PDF document.")
    }

    return data
  }

  async listCancelledOlderThan(organizationId: string, olderThanIso: string, limit = 100) {
    const { data, error } = await this.db
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "cancelled")
      .lte("cancelled_at", olderThanIso)
      .is("deleted_at", null)
      .order("cancelled_at", { ascending: true })
      .limit(limit)

    if (error) {
      throwRepositoryError(error, "Unable to load cancelled invoices.")
    }

    return data ?? []
  }
}

type CreateMonthlyFeeInvoiceAtomicRpcClient = {
  rpc(
    fn: "create_monthly_fee_invoice_atomic",
    args: {
      p_organization_id: string
      p_monthly_fee_record_id: string
      p_actor_user_id: string
    }
  ): Promise<{ data: InvoiceRow | null; error: PostgrestError | null }>
}
