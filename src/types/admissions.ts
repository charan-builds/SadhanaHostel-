import type { Json } from "@/types/database"

export type LeadSource =
  | "phone"
  | "whatsapp"
  | "website"
  | "walk_in"
  | "referral"
  | "other"

export type LeadStatus =
  | "new_inquiry"
  | "called"
  | "interested"
  | "reserved"
  | "confirmed"
  | "cancelled"
  | "joined"

export type ReservationStatus =
  | "pending"
  | "reserved"
  | "confirmed"
  | "expired"
  | "cancelled"
  | "converted_to_resident"

export type ReservationPaymentStatus =
  | "pending"
  | "proof_uploaded"
  | "verified"
  | "rejected"
  | "refunded"
  | "cancelled"

export type ResidentType = "student" | "employee" | "other"
export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "card" | "netbanking" | "wallet" | "cashfree" | "advance" | "adjustment"

type AuditColumns = {
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type HostelCapacityRow = AuditColumns & {
  id: string
  organization_id: string
  hostel_id: string
  total_beds: number
  occupied_beds: number
  reserved_beds: number
  maintenance_blocked_beds: number
  available_beds: number
  last_calculated_at: string
  notes: string | null
  metadata: Json
}

export type RoomCapacityRow = AuditColumns & {
  id: string
  organization_id: string
  hostel_id: string
  room_id: string
  total_beds: number
  occupied_beds: number
  reserved_beds: number
  maintenance_blocked_beds: number
  available_beds: number
  last_calculated_at: string
  notes: string | null
  metadata: Json
}

export type LeadRow = AuditColumns & {
  id: string
  organization_id: string
  hostel_id: string | null
  full_name: string
  phone: string
  whatsapp_number: string | null
  email: string | null
  resident_type: ResidentType
  desired_joining_date: string | null
  expected_stay_duration: string | null
  parent_name: string | null
  parent_phone: string | null
  notes: string | null
  source: LeadSource
  status: LeadStatus
  assigned_to: string | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  cancelled_reason: string | null
  joined_resident_id: string | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  metadata: Json
}

export type LeadNoteRow = AuditColumns & {
  id: string
  organization_id: string
  hostel_id: string | null
  lead_id: string
  note: string
  is_pinned: boolean
  metadata: Json
}

export type LeadActivityRow = AuditColumns & {
  id: string
  organization_id: string
  hostel_id: string | null
  lead_id: string | null
  reservation_id: string | null
  activity_type: string
  description: string
  actor_user_id: string | null
  metadata: Json
}

export type ReservationRow = AuditColumns & {
  id: string
  organization_id: string
  hostel_id: string
  lead_id: string
  reserved_room_id: string | null
  reserved_bed_count: number
  reserved_until: string
  advance_amount: number
  status: ReservationStatus
  confirmed_at: string | null
  cancelled_at: string | null
  expired_at: string | null
  converted_at: string | null
  converted_resident_id: string | null
  notes: string | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  metadata: Json
}

export type ReservationPaymentRow = AuditColumns & {
  id: string
  organization_id: string
  hostel_id: string
  reservation_id: string
  lead_id: string
  amount: number
  method: PaymentMethod
  status: ReservationPaymentStatus
  transaction_id: string | null
  proof_document_id: string | null
  invoice_id: string | null
  paid_at: string | null
  verified_at: string | null
  verified_by: string | null
  rejection_reason: string | null
  notes: string | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  metadata: Json
}

export type RoomVacancyRow = {
  organization_id: string
  hostel_id: string
  room_id: string
  room_number: string
  room_name: string | null
  room_type: string
  room_status: string
  total_beds: number
  occupied_beds: number
  reserved_beds: number
  maintenance_blocked_beds: number
  available_beds: number
  calculated_at: string
}

export type HostelVacancyRow = {
  organization_id: string
  hostel_id: string
  hostel_name: string
  total_beds: number
  occupied_beds: number
  reserved_beds: number
  maintenance_blocked_beds: number
  available_beds: number
  calculated_at: string
}

export type AdmissionsAnalytics = {
  totalLeads: number
  newInquiries: number
  interestedLeads: number
  activeReservations: number
  confirmedReservations: number
  joinedLeads: number
  cancelledLeads: number
  conversionRate: number
  cancellationRate: number
  pendingFollowUps: number
}
