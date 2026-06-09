import type { Json } from "@/types/database"

export type WhatsappAutomationEventKey =
  | "admission_created"
  | "resident_activated"
  | "monthly_invoice_generated"
  | "payment_received"
  | "payment_verified"
  | "leave_submitted"
  | "leave_approved"
  | "leave_rejected"
  | "notice_published"
  | "checkout_completed"

export type WhatsappQueueStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled"

export type WhatsappTemplateRow = {
  id: string
  organization_id: string
  hostel_id: string | null
  event_key: WhatsappAutomationEventKey
  name: string
  body_template: string
  enabled: boolean
  version: number
  variables: Json
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type WhatsappQueueRow = {
  id: string
  organization_id: string
  hostel_id: string | null
  template_id: string | null
  resident_id: string | null
  recipient_user_id: string | null
  event_key: WhatsappAutomationEventKey
  recipient_phone: string
  rendered_message: string
  payload: Json
  status: WhatsappQueueStatus
  attempt_count: number
  max_attempts: number
  scheduled_for: string
  last_attempt_at: string | null
  next_attempt_at: string | null
  provider: string | null
  provider_message_id: string | null
  failure_reason: string | null
  idempotency_key: string | null
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type WhatsappDeliveryEventRow = {
  id: string
  organization_id: string
  hostel_id: string | null
  queue_id: string
  status: string
  provider_message_id: string | null
  error_message: string | null
  payload: Json
  created_at: string
  created_by: string | null
}

export type WhatsappAutomationAnalytics = {
  sent: number
  delivered: number
  failed: number
  retried: number
  queued: number
  templatesEnabled: number
  templatesDisabled: number
}

export type WhatsappAutomationDashboard = {
  templates: WhatsappTemplateRow[]
  recentQueue: WhatsappQueueRow[]
  analytics: WhatsappAutomationAnalytics
}
