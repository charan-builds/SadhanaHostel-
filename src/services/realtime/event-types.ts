import type { Json } from "@/types/database"

export type RealtimeEventType =
  | "notification.created"
  | "payment.status_changed"
  | "leave.status_changed"
  | "dashboard.refresh"
  | "vacancy.changed"
  | "lead.created"
  | "lead.updated"
  | "reservation.created"
  | "reservation.confirmed"
  | "reservation.expired"
  | "reservation.converted"

export type TenantRealtimeEvent<TPayload extends Json = Json> = {
  type: RealtimeEventType
  organizationId: string
  hostelId?: string | null
  actorUserId?: string | null
  occurredAt: string
  payload: TPayload
}
