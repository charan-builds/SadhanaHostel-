import type { Tables } from "@/types/database"

export type HostelRule = Tables<"hostel_rules">
export type HostelRuleAcceptance = Tables<"hostel_rule_acceptances">

export type HostelRuleAcceptanceStatus = {
  isAccepted: boolean
  acceptedAt: string | null
  rulesVersion: string
  latestAcceptedVersion: string | null
  latestAcceptedAt: string | null
}

export type HostelRulesOverview = {
  rules: HostelRule[]
  rulesVersion: string
  lastUpdated: string | null
  categories: string[]
  acceptance?: HostelRuleAcceptanceStatus
}
