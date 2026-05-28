import type { Json } from "@/types/database"
import type { ResidentIdentityMode } from "@/lib/resident-identity"

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
  identityMode: ResidentIdentityMode
  maskedEmail: string | null
  maskedPhone: string | null
  emailRequired: boolean
  phoneRequired: boolean
  authLinked: boolean
  activationState:
    | "activation_pending"
    | "auth_linked"
    | "onboarding_pending"
    | "verified"
    | "suspended"
  expiresAt: string
  status: ResidentInviteStatus
}

export type ResidentInviteCreated = {
  invite: ResidentInviteRow
  activationLink: string | null
  loginLink: string
  whatsappShareUrl: string | null
  delivery: {
    emailQueued: boolean
    whatsappReady: boolean
    accessMode: "activation_link" | "temporary_password"
    temporaryPassword?: string | null
  }
}

export type ResidentActivationResult = {
  authenticatedIdentifier: string
  residentId: string
  redirectTo: string
}
