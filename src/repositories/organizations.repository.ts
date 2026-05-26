import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"

import { throwRepositoryError, type AppSupabaseClient } from "./types"

export type OrganizationRow = Tables<"organizations">
export type HostelRow = Tables<"hostels">

export type BootstrapTenantResult = {
  organization: OrganizationRow
  hostel: HostelRow
}

type BootstrapTenantArgs = {
  organizationName: string
  organizationPhone?: string
  organizationEmail?: string
  organizationAddress?: string
  organizationCity?: string
  organizationState?: string
  hostelName?: string
  hostelPhone?: string
  hostelEmail?: string
  hostelAddress?: string
  hostelCity?: string
  hostelState?: string
  hostelCapacity?: number
  upiId?: string
  paymentAccountName?: string
  paymentInstructions?: string
}

type BootstrapRpcClient = {
  rpc(
    functionName: "bootstrap_admin_tenant_atomic",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: Parameters<typeof throwRepositoryError>[0] }>
}

type GenericQueryBuilder = {
  insert(values: unknown): GenericQueryBuilder
  update(values: unknown): GenericQueryBuilder
  eq(column: string, value: unknown): GenericQueryBuilder
  select(columns?: string): GenericQueryBuilder
  single(): Promise<{ data: unknown; error: Parameters<typeof throwRepositoryError>[0] }>
}

type OperationalControlDb = {
  from(table: "hostel_capacity"): GenericQueryBuilder
}

export class OrganizationsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async bootstrapAdminTenant(args: BootstrapTenantArgs) {
    const { data, error } = await (this.db as unknown as BootstrapRpcClient).rpc(
      "bootstrap_admin_tenant_atomic",
      {
        p_organization_name: args.organizationName,
        p_organization_phone: args.organizationPhone ?? null,
        p_organization_email: args.organizationEmail ?? null,
        p_organization_address: args.organizationAddress ?? null,
        p_organization_city: args.organizationCity ?? null,
        p_organization_state: args.organizationState ?? null,
        p_hostel_name: args.hostelName ?? null,
        p_hostel_phone: args.hostelPhone ?? null,
        p_hostel_email: args.hostelEmail ?? null,
        p_hostel_address: args.hostelAddress ?? null,
        p_hostel_city: args.hostelCity ?? null,
        p_hostel_state: args.hostelState ?? null,
        p_hostel_capacity: args.hostelCapacity ?? 70,
        p_upi_id: args.upiId ?? null,
        p_payment_account_name: args.paymentAccountName ?? null,
        p_payment_instructions: args.paymentInstructions ?? null,
      }
    )

    if (error) {
      throwRepositoryError(error, "Unable to bootstrap admin tenant.")
    }

    return data as BootstrapTenantResult
  }

  async getOrganizationById(organizationId: string) {
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

  async updateOrganization(
    organizationId: string,
    values: TablesUpdate<"organizations">
  ) {
    const { data, error } = await this.db
      .from("organizations")
      .update(values)
      .eq("id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update organization.")
    }

    return data
  }

  async listActiveOrganizations() {
    const { data, error } = await this.db
      .from("organizations")
      .select("*")
      .eq("is_active", true)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })

    if (error) {
      throwRepositoryError(error, "Unable to load active organizations.")
    }

    return data ?? []
  }

  async listHostels(organizationId: string) {
    const { data, error } = await this.db
      .from("hostels")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })

    if (error) {
      throwRepositoryError(error, "Unable to load hostels.")
    }

    return data ?? []
  }

  async getHostelById(organizationId: string, hostelId: string) {
    const { data, error } = await this.db
      .from("hostels")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", hostelId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load hostel.")
    }

    return data
  }

  async listActiveHostels(organizationId: string) {
    const { data, error } = await this.db
      .from("hostels")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })

    if (error) {
      throwRepositoryError(error, "Unable to load active hostels.")
    }

    return data ?? []
  }

  async createHostel(values: TablesInsert<"hostels">) {
    const { data, error } = await this.db
      .from("hostels")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create hostel.")
    }

    return data
  }

  async createHostelCapacity(values: {
    organization_id: string
    hostel_id: string
    total_beds: number
    notes?: string
    created_by?: string
    updated_by?: string
  }) {
    const { data, error } = await this.operationalControlDb()
      .from("hostel_capacity")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create hostel capacity.")
    }

    return data
  }

  async updateHostelCapacity(
    organizationId: string,
    hostelId: string,
    values: {
      total_beds?: number
      maintenance_blocked_beds?: number
      notes?: string
      updated_by?: string
    }
  ) {
    const { data, error } = await this.operationalControlDb()
      .from("hostel_capacity")
      .update(values)
      .eq("organization_id", organizationId)
      .eq("hostel_id", hostelId)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update hostel capacity.")
    }

    return data
  }

  async updateHostel(
    organizationId: string,
    hostelId: string,
    values: TablesUpdate<"hostels">
  ) {
    const { data, error } = await this.db
      .from("hostels")
      .update(values)
      .eq("organization_id", organizationId)
      .eq("id", hostelId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update hostel.")
    }

    return data
  }

  async createAuditLog(values: TablesInsert<"audit_logs">) {
    const { error } = await this.db.from("audit_logs").insert(values)

    if (error) {
      throwRepositoryError(error, "Unable to record platform audit log.")
    }
  }

  private operationalControlDb() {
    return this.db as unknown as OperationalControlDb
  }
}
