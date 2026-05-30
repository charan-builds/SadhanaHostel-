import "server-only"

import { logger } from "@/lib/logger"
import { incrementMetric } from "@/lib/metrics"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Json } from "@/types/database"

import type { RealtimeEventType, TenantRealtimeEvent } from "./event-types"

export type PublishRealtimeEventInput<TPayload extends Json = Json> = {
  type: RealtimeEventType
  organizationId: string
  hostelId?: string | null
  residentId?: string | null
  actorUserId?: string | null
  payload: TPayload
}

export class RealtimeEventPublisher {
  constructor(private readonly db: AppSupabaseClient = createSupabaseAdminClient()) {}

  async publish<TPayload extends Json>(input: PublishRealtimeEventInput<TPayload>) {
    const event: TenantRealtimeEvent<TPayload> = {
      type: input.type,
      organizationId: input.organizationId,
      hostelId: input.hostelId,
      residentId: input.residentId,
      actorUserId: input.actorUserId,
      occurredAt: new Date().toISOString(),
      payload: input.payload,
    }
    const channelName = input.residentId && input.hostelId
      ? buildResidentChannelName(input.organizationId, input.hostelId, input.residentId)
      : buildTenantChannelName(input.organizationId, input.hostelId)

    try {
      const channel = this.db.channel(channelName, {
        config: {
          private: true,
          broadcast: {
            ack: false,
            self: false,
          },
        },
      })

      await channel.send({
        type: "broadcast",
        event: input.type,
        payload: event,
      })

      incrementMetric("realtime.published", 1, {
        event: input.type,
        organizationId: input.organizationId,
      })

      logger.info({
        event: "realtime.published",
        message: "Realtime tenant event published.",
        organizationId: input.organizationId,
        userId: input.actorUserId,
        metadata: {
          eventType: input.type,
          channelName,
        },
      })
    } catch (error) {
      logger.warn({
        event: "realtime.publish_failed",
        message: "Realtime publish failed; primary workflow was preserved.",
        organizationId: input.organizationId,
        error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
        metadata: {
          eventType: input.type,
          channelName,
        },
      })
    }

    return event
  }
}

export function buildTenantChannelName(organizationId: string, hostelId?: string | null) {
  return hostelId
    ? `tenant:${organizationId}:hostel:${hostelId}`
    : `tenant:${organizationId}:global`
}

export function buildResidentChannelName(
  organizationId: string,
  hostelId: string,
  residentId: string
) {
  return `${buildTenantChannelName(organizationId, hostelId)}:resident:${residentId}`
}
