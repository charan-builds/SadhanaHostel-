import type { Json } from "@/types/database"

export type RealtimeEventType =
  | "notification.created"
  | "payment.status_changed"
  | "payment.submitted"
  | "payment.approved"
  | "payment.rejected"
  | "payment.settings_changed"
  | "invoice.generated"
  | "leave.status_changed"
  | "dashboard.refresh"
  | "vacancy.changed"
  | "room.allocation_changed"
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
  | "resident.onboarding_updated"
  | "staff.created"
  | "staff.role_changed"
  | "staff.access_revoked"
  | "staff.password_reset"

export type TenantRealtimeEvent<TPayload extends Json = Json> = {
  type: RealtimeEventType
  organizationId: string
  hostelId?: string | null
  actorUserId?: string | null
  occurredAt: string
  payload: TPayload
}
