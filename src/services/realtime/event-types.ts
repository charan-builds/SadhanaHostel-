import type { Json } from "@/types/database"

export type RealtimeEventType =
  | "notification.created"
  | "payment.status_changed"
  | "payment.settings_changed"
  | "leave.status_changed"
  | "dashboard.refresh"
  | "vacancy.changed"
  | "room.allocation_changed"
  | "room.transfer_completed"
  | "lead.created"
  | "lead.updated"
  | "reservation.created"
  | "reservation.confirmed"
  | "reservation.expired"
  | "reservation.converted"
  | "resident.invite_created"
  | "resident.invite_resent"
  | "resident.invite_revoked"
  | "resident.invite_used"
  | "resident.created"
  | "resident.updated"
  | "resident.deactivated"
  | "resident.checked_out"
  | "staff.created"
  | "staff.role_changed"
  | "staff.access_revoked"
  | "staff.password_reset"

export type TenantRealtimeEvent<TPayload extends Json = Json> = {
  type: RealtimeEventType
  organizationId: string
  hostelId?: string | null
  residentId?: string | null
  actorUserId?: string | null
  occurredAt: string
  payload: TPayload
}
