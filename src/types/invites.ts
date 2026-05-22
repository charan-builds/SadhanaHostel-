import type { Json } from "@/types/database"

export type ResidentInviteStatus = "pending" | "used" | "expired" | "revoked"

export type ResidentInviteRow = {
  id: string
  organization_id: string
  hostel_id: string
  resident_id: string
  email: string | null
  phone: string | null
  invite_code: string
  invite_token_hash: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
  invited_by: string | null
  status: ResidentInviteStatus
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type ResidentInviteSafe = {
  id: string
  residentId: string
  organizationId: string
  hostelId: string
  residentName: string
  admissionNumber: string
  maskedEmail: string | null
  maskedPhone: string | null
  expiresAt: string
  status: ResidentInviteStatus
}

export type ResidentInviteCreated = {
  invite: ResidentInviteRow
  activationLink: string
  whatsappShareUrl: string | null
  delivery: {
    emailQueued: boolean
    whatsappReady: boolean
  }
}

export type ResidentActivationResult = {
  authenticatedIdentifier: string
  residentId: string
  redirectTo: string
}
