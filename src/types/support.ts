import type { Tables } from "@/types/database"
import type { ResidentPasswordResetResult } from "@/types/residents"

export type RecoveryGuidance = {
  title: string
  summary: string
  steps: string[]
  primaryActionLabel: string
  primaryActionHref: string
}

export type SupportRequestResult = {
  request: Tables<"support_requests">
  reused: boolean
  guidance: RecoveryGuidance
}

export type ResidentPasswordResetRequestResult = {
  accepted: true
}

export type SupportPasswordResetApprovalResult = {
  request: Tables<"support_requests">
  reset: ResidentPasswordResetResult
  whatsappMessage: string
  whatsappShareUrl: string
}

export type SupportPublishNoticeResult = {
  request: Tables<"support_requests">
  notice: Tables<"notices">
}

export type OperationalAlert = {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  count: number
  href: string
  ctaLabel: string
}
