import type { PostgrestError } from "@supabase/supabase-js"

import type { Json } from "@/types/database"
import type {
  WhatsappAutomationEventKey,
  WhatsappDeliveryEventRow,
  WhatsappQueueRow,
  WhatsappQueueStatus,
  WhatsappTemplateRow,
} from "@/types/whatsapp-automation"

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
  lte(column: string, value: unknown): GenericQueryBuilder
  order(column: string, options?: { ascending?: boolean }): GenericQueryBuilder
  limit(count: number): GenericQueryBuilder
  range(from: number, to: number): Promise<QueryResult<unknown[]>>
  maybeSingle(): Promise<QueryResult<unknown>>
  single(): Promise<QueryResult<unknown>>
}

type GenericWhatsappDb = {
  from(table: string): GenericQueryBuilder
}

export class WhatsappAutomationRepository {
  constructor(private readonly db: AppSupabaseClient) {}

  async listTemplates(input: {
    organizationId: string
    hostelId?: string | null
  }) {
    let query = this.typedDb()
      .from("whatsapp_message_templates")
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("event_key", { ascending: true })
      .order("version", { ascending: false })

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.range(0, 1000)

    if (error) {
      throwRepositoryError(error, "Unable to load WhatsApp templates.")
    }

    return (data ?? []) as WhatsappTemplateRow[]
  }

  async getTemplate(organizationId: string, templateId: string) {
    const { data, error } = await this.typedDb()
      .from("whatsapp_message_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", templateId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load WhatsApp template.")
    }

    return data as WhatsappTemplateRow | null
  }

  async getLatestTemplate(input: {
    organizationId: string
    hostelId?: string | null
    eventKey: WhatsappAutomationEventKey
    enabledOnly?: boolean
  }) {
    let query = this.typedDb()
      .from("whatsapp_message_templates")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("event_key", input.eventKey)
      .is("deleted_at", null)
      .order("version", { ascending: false })
      .limit(1)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    } else {
      query = query.is("hostel_id", null)
    }

    if (input.enabledOnly) {
      query = query.eq("enabled", true)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load latest WhatsApp template.")
    }

    return data as WhatsappTemplateRow | null
  }

  async createTemplate(values: {
    organization_id: string
    hostel_id?: string | null
    event_key: WhatsappAutomationEventKey
    name: string
    body_template: string
    enabled: boolean
    version: number
    variables?: Json
    metadata?: Json
    created_by?: string | null
    updated_by?: string | null
  }) {
    const { data, error } = await this.typedDb()
      .from("whatsapp_message_templates")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to save WhatsApp template.")
    }

    return data as WhatsappTemplateRow
  }

  async updateTemplate(input: {
    organizationId: string
    templateId: string
    values: Record<string, unknown>
  }) {
    const { data, error } = await this.typedDb()
      .from("whatsapp_message_templates")
      .update(input.values)
      .eq("organization_id", input.organizationId)
      .eq("id", input.templateId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update WhatsApp template.")
    }

    return data as WhatsappTemplateRow
  }

  async createQueue(values: {
    organization_id: string
    hostel_id?: string | null
    template_id?: string | null
    resident_id?: string | null
    recipient_user_id?: string | null
    event_key: WhatsappAutomationEventKey
    recipient_phone: string
    rendered_message: string
    payload?: Json
    scheduled_for?: string
    idempotency_key?: string | null
    metadata?: Json
    created_by?: string | null
    updated_by?: string | null
  }) {
    const { data, error } = await this.typedDb()
      .from("whatsapp_message_queue")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      if (error.code === "23505" && values.idempotency_key) {
        const existing = await this.findQueueByIdempotencyKey(
          values.organization_id,
          values.idempotency_key
        )

        if (existing) {
          return existing
        }
      }

      throwRepositoryError(error, "Unable to queue WhatsApp message.")
    }

    return data as WhatsappQueueRow
  }

  async findQueueByIdempotencyKey(organizationId: string, idempotencyKey: string) {
    const { data, error } = await this.typedDb()
      .from("whatsapp_message_queue")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("idempotency_key", idempotencyKey)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throwRepositoryError(error, "Unable to load idempotent WhatsApp queue row.")
    }

    return data as WhatsappQueueRow | null
  }

  async listRecentQueue(input: {
    organizationId: string
    hostelId?: string | null
    limit?: number
  }) {
    let query = this.typedDb()
      .from("whatsapp_message_queue")
      .select("*")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 50)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.range(0, (input.limit ?? 50) - 1)

    if (error) {
      throwRepositoryError(error, "Unable to load WhatsApp queue.")
    }

    return (data ?? []) as WhatsappQueueRow[]
  }

  async listDueQueue(input: {
    organizationId: string
    hostelId?: string | null
    limit: number
  }) {
    const now = new Date().toISOString()
    let query = this.typedDb()
      .from("whatsapp_message_queue")
      .select("*")
      .eq("organization_id", input.organizationId)
      .in("status", ["queued", "failed"])
      .lte("scheduled_for", now)
      .is("deleted_at", null)
      .order("scheduled_for", { ascending: true })
      .limit(input.limit)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    const { data, error } = await query.range(0, input.limit - 1)

    if (error) {
      throwRepositoryError(error, "Unable to load due WhatsApp queue.")
    }

    return (data ?? [])
      .filter((row) => {
        const queue = row as WhatsappQueueRow

        return queue.attempt_count < queue.max_attempts
      }) as WhatsappQueueRow[]
  }

  async updateQueue(input: {
    organizationId: string
    queueId: string
    values: Record<string, unknown>
  }) {
    const { data, error } = await this.typedDb()
      .from("whatsapp_message_queue")
      .update(input.values)
      .eq("organization_id", input.organizationId)
      .eq("id", input.queueId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to update WhatsApp queue.")
    }

    return data as WhatsappQueueRow
  }

  async createDeliveryEvent(values: {
    organization_id: string
    hostel_id?: string | null
    queue_id: string
    status: string
    provider_message_id?: string | null
    error_message?: string | null
    payload?: Json
    created_by?: string | null
  }) {
    const { data, error } = await this.typedDb()
      .from("whatsapp_delivery_events")
      .insert(values)
      .select("*")
      .single()

    if (error) {
      throwRepositoryError(error, "Unable to record WhatsApp delivery event.")
    }

    return data as WhatsappDeliveryEventRow
  }

  async countQueue(input: {
    organizationId: string
    hostelId?: string | null
    status?: WhatsappQueueStatus
    retried?: boolean
  }) {
    let query = this.typedDb()
      .from("whatsapp_message_queue")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)

    if (input.hostelId) {
      query = query.eq("hostel_id", input.hostelId)
    }

    if (input.status) {
      query = query.eq("status", input.status)
    }

    if (input.retried) {
      query = query.in("attempt_count", [2, 3, 4, 5, 6, 7, 8, 9, 10])
    }

    const { count, error } = await query.range(0, 0)

    if (error) {
      throwRepositoryError(error, "Unable to count WhatsApp queue.")
    }

    return count ?? 0
  }

  private typedDb() {
    return this.db as unknown as GenericWhatsappDb
  }
}
