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
