import type { JobResult } from "@/jobs/types"

export type ConsistencySeverity = "critical" | "high" | "medium" | "low"

export type ConsistencyFinding = {
  id: string
  category:
    | "orphan_data"
    | "onboarding"
    | "reservation"
    | "invite"
    | "occupancy"
    | "invoice"
    | "payment"
    | "upload"
    | "checkout"
  severity: ConsistencySeverity
  title: string
  description: string
  count: number
  repairAction:
    | "expire_reservations"
    | "expire_invites"
    | "cleanup_uploads"
    | "recalculate_occupancy"
    | "generate_fees"
    | "run_consistency_scan"
    | "review_manually"
}

export type ConsistencyReport = {
  organizationId: string
  hostelId?: string | null
  generatedAt: string
  score: number
  findings: ConsistencyFinding[]
  summaries: {
    critical: number
    high: number
    medium: number
    low: number
    totalFindings: number
  }
}

export type AutomationJobConfig = {
  name: string
  cronName?: string
  queueName: string
  title: string
  description: string
  schedule: string
  enabled: boolean
  dryRunSupported: boolean
  destructive: boolean
}

export type AutomationDashboard = {
  organizationId: string
  hostelId?: string | null
  jobs: AutomationJobConfig[]
  recentRuns: Array<{
    id: string
    jobName: string | null
    status: string
    createdAt: string
    requestId: string | null
    metadata: Record<string, unknown>
  }>
  consistency: ConsistencyReport
}

export type AutomationRunResult = {
  jobName: string
  dryRun: boolean
  result: JobResult
}
