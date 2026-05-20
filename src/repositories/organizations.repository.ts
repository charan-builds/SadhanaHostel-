import type { Tables } from "@/types/database"

import { throwRepositoryError, type AppSupabaseClient } from "./types"

export type OrganizationRow = Tables<"organizations">
export type HostelRow = Tables<"hostels">

export class OrganizationsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

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
}
