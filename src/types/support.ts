import type { Tables } from "@/types/database"

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

export type OperationalAlert = {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  count: number
  href: string
  ctaLabel: string
}
