import type { Tables } from "./database"
import type { ResidentInviteCreated } from "./invites"

export type CurrentResidentProfile = Tables<"residents"> & {
  current_room_allocation_id?: string | null
  current_room_number?: string | null
  current_room_name?: string | null
  current_bed_label?: string | null
}

export type ResidentCreateResult = {
  resident: Tables<"residents">
  invite: ResidentInviteCreated | null
  advancePayment: Tables<"payments"> | null
  firstMonthFeePayment: Tables<"payments"> | null
  openingMonthFeePayments: Tables<"payments">[]
}

export type ResidentPasswordResetResult = {
  residentId: string
  targetUserId: string
  residentName?: string | null
  residentPhone?: string | null
  temporaryPassword: string
  expiresAt: string
  loginLink: string
}

export type ResidentLifecycleRepairTimelineEvent = {
  stage: string
  at?: string
  state?: Record<string, unknown>
  after?: Record<string, unknown>
  authMatchCount?: number
  selectedAuthUserId?: string | null
  repairDecision?: string
  dryRun?: boolean
  wouldExpireInvites?: number
  wouldRevokeDuplicateInvites?: number
  wouldRevokeStaleInvites?: number
  wouldReleaseAllocations?: number
  wouldCancelFeeRecords?: number
  wouldCancelInvoices?: number
  [key: string]: unknown
}

export type ResidentLifecycleRepairResult = {
  dryRun: boolean
  correlationId?: string
  residentId: string
  organizationId: string
  hostelId: string | null
  authMatchCount?: number
  selectedAuthUserId?: string | null
  repairs: {
    expiredInvites?: number
    duplicateInvitesRevoked?: number
    staleInvitesRevoked?: number
    authLinkRepaired?: number
    profilesSynced?: number
    rolesSynced?: number
    onboardingAdvanced?: number
    allocationsReleased?: number
    feeRecordsCancelled?: number
    invoicesCancelled?: number
    hostelsRecalculated?: number
  }
  timeline: ResidentLifecycleRepairTimelineEvent[]
}
