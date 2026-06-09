import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"

import {
  throwRepositoryError,
  type AppSupabaseClient,
} from "./types"

export type PushSubscriptionRow = Tables<"push_subscriptions">

export class PushSubscriptionsRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async upsert(values: TablesInsert<"push_subscriptions">) {
    const { data, error } = await this.db
      .from("push_subscriptions")
      .upsert(values, { onConflict: "endpoint" })
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to save push subscription.")
    }

    return data
  }

  async listActiveForRecipient(input: {
    organizationId: string
    userId?: string | null
    residentId?: string | null
  }) {
    if (!input.userId && !input.residentId) {
      return []
    }

    let query = this.db
      .from("push_subscriptions")
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("revoked_at", null)

    if (input.userId) {
      query = query.eq("user_id", input.userId)
    } else if (input.residentId) {
      query = query.eq("resident_id", input.residentId)
    }

    const { data, error } = await query.order("last_seen_at", { ascending: false })

    if (error) {
      throwRepositoryError(error, "Unable to load push subscriptions.")
    }

    return data ?? []
  }

  async update(input: {
    subscriptionId: string
    organizationId: string
    values: TablesUpdate<"push_subscriptions">
  }) {
    const { data, error } = await this.db
      .from("push_subscriptions")
      .update(input.values)
      .eq("id", input.subscriptionId)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update push subscription.")
    }

    return data
  }

  async revokeForUser(input: {
    organizationId: string
    userId: string
    endpoint?: string
    actorUserId?: string | null
  }) {
    const now = new Date().toISOString()
    let query = this.db
      .from("push_subscriptions")
      .update({
        revoked_at: now,
        revoked_by: input.actorUserId ?? input.userId,
        updated_by: input.actorUserId ?? input.userId,
      })
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .is("revoked_at", null)

    if (input.endpoint) {
      query = query.eq("endpoint", input.endpoint)
    }

    const { data, error } = await query.select("id")

    if (error) {
      throwRepositoryError(error, "Unable to revoke push subscriptions.")
    }

    return data?.length ?? 0
  }

  async revokeEndpoint(input: {
    organizationId: string
    endpoint: string
    actorUserId?: string | null
  }) {
    const now = new Date().toISOString()
    const { data, error } = await this.db
      .from("push_subscriptions")
      .update({
        revoked_at: now,
        revoked_by: input.actorUserId ?? null,
        updated_by: input.actorUserId ?? null,
      })
      .eq("organization_id", input.organizationId)
      .eq("endpoint", input.endpoint)
      .is("revoked_at", null)
      .select("id")

    if (error) {
      throwRepositoryError(error, "Unable to revoke push endpoint.")
    }

    return data?.length ?? 0
  }
}
