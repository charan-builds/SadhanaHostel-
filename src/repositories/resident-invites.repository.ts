import type { PostgrestError } from "@supabase/supabase-js"

import type { ResidentInviteRow } from "@/types/invites"
import type { Json } from "@/types/database"

import {
  throwRepositoryError,
  type AppSupabaseClient,
} from "./types"

type QueryResult<T> = {
  data: T | null
  error: PostgrestError | null
}

type CountedQueryResult<T> = QueryResult<T> & {
  count: number | null
}

type GenericQueryBuilder = {
  select(columns?: string, options?: { count?: "exact" }): GenericQueryBuilder
  insert(values: unknown): GenericQueryBuilder
  update(values: unknown): GenericQueryBuilder
  eq(column: string, value: unknown): GenericQueryBuilder
  is(column: string, value: boolean | null): GenericQueryBuilder
  gt(column: string, value: unknown): GenericQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericQueryBuilder
  limit(count: number): GenericQueryBuilder
  range(from: number, to: number): Promise<CountedQueryResult<unknown[]>>
  single(): Promise<QueryResult<unknown>>
  maybeSingle(): Promise<QueryResult<unknown>>
}

type GenericInviteDb = {
  from(table: string): GenericQueryBuilder
  rpc(functionName: string, args?: Record<string, unknown>): Promise<QueryResult<unknown>>
}

export type CreateResidentInviteValues = {
  organization_id: string
  hostel_id: string
  resident_id: string
  email?: string | null
  phone?: string | null
  invite_code: string
  invite_token_hash: string
  expires_at: string
  invited_by: string
  metadata?: Json
  created_by?: string | null
  updated_by?: string | null
}

export class ResidentInvitesRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async listForResident(organizationId: string, residentId: string) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("resident_id", residentId)
      .order("created_at", { ascending: false })
      .range(0, 9)

    if (error) {
      throwRepositoryError(error, "Unable to list resident invites.")
    }

    return (data ?? []) as ResidentInviteRow[]
  }

  async getById(inviteId: string, organizationId: string) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load resident invite.")
    }

    return data as ResidentInviteRow | null
  }

  async findActiveByResident(organizationId: string, residentId: string) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("resident_id", residentId)
      .eq("status", "pending")
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load active resident invite.")
    }

    return data as ResidentInviteRow | null
  }

  async findByTokenHash(inviteTokenHash: string) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .select("*")
      .eq("invite_token_hash", inviteTokenHash)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to validate invite token.")
    }

    return data as ResidentInviteRow | null
  }

  async findByCodeAndIdentity(input: {
    inviteCode: string
    email?: string
    phone?: string
  }) {
    const query = this.inviteDb()
      .from("resident_invites")
      .select("*")
      .eq("invite_code", input.inviteCode)
      .eq("status", "pending")
      .is("used_at", null)
      .is("revoked_at", null)

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to validate invite code.")
    }

    return data as ResidentInviteRow | null
  }

  async create(values: CreateResidentInviteValues) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to create resident invite.")
    }

    return data as ResidentInviteRow
  }

  async revokeActiveForResident(
    organizationId: string,
    residentId: string,
    actorUserId: string
  ) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_by: actorUserId,
      })
      .eq("organization_id", organizationId)
      .eq("resident_id", residentId)
      .eq("status", "pending")
      .is("used_at", null)
      .is("revoked_at", null)
      .select("*")
      .range(0, 1000)

    if (error) {
      throwRepositoryError(error, "Unable to revoke previous resident invites.")
    }

    return (data ?? []) as ResidentInviteRow[]
  }

  async revoke(inviteId: string, organizationId: string, actorUserId: string) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_by: actorUserId,
      })
      .eq("id", inviteId)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .is("used_at", null)
      .is("revoked_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to revoke resident invite.")
    }

    return data as ResidentInviteRow
  }

  async markUsed(inviteId: string, organizationId: string, userId: string) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", inviteId)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .is("used_at", null)
      .is("revoked_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to mark resident invite used.")
    }

    return data as ResidentInviteRow
  }

  async markExpired(inviteId: string) {
    const { data, error } = await this.inviteDb()
      .from("resident_invites")
      .update({
        status: "expired",
      })
      .eq("id", inviteId)
      .eq("status", "pending")
      .is("used_at", null)
      .is("revoked_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to mark resident invite expired.")
    }

    return data as ResidentInviteRow
  }

  async expireDue(input: {
    organizationId?: string
    hostelId?: string
    limit?: number
  }) {
    const { data, error } = await this.inviteDb().rpc("expire_resident_invites", {
      p_organization_id: input.organizationId ?? null,
      p_hostel_id: input.hostelId ?? null,
      p_limit: input.limit ?? 500,
    })

    if (error) {
      throwRepositoryError(error, "Unable to expire resident invites.")
    }

    const rows = (data ?? []) as Array<{ expired_count: number }>

    return rows[0]?.expired_count ?? 0
  }

  private inviteDb() {
    return this.db as unknown as GenericInviteDb
  }
}
