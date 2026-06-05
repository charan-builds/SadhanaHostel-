import type { JobResult } from "@/jobs/types"

export type ConsistencySeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational"

export type ConsistencyRepairAction =
  | "expire_reservations"
  | "expire_invites"
  | "cleanup_uploads"
  | "recalculate_occupancy"
  | "repair_tenant_linkage"
  | "dedupe_invites"
  | "release_stale_allocations"
  | "resync_auth_linkage"
  | "repair_analytics"
  | "repair_financial_reconciliation"
  | "reconcile_dues"
  | "generate_fees"
  | "run_consistency_scan"
  | "review_manually"

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
    | "security"
  severity: ConsistencySeverity
  title: string
  description: string
  count: number
  details?: Array<{
    tableName: string
    recordId: string | null
    residentId?: string | null
    organizationId?: string | null
    hostelId?: string | null
    anomalyType: string
    expectedState?: string | null
    actualState?: string | null
    expectedOrganizationId?: string | null
    actualOrganizationId?: string | null
    expectedHostelId?: string | null
    actualHostelId?: string | null
    recommendedRepairAction?: ConsistencyRepairAction
    recommendation: string
  }>
  repairAction: ConsistencyRepairAction
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
    informational: number
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

export type DemoDataResetAuthUser = {
  id: string
  email?: string | null
  phone?: string | null
  reason: string
}

export type DemoDataResetStorageObject = {
  bucket: string
  path: string
  sourceTable?: string | null
  recordId?: string | null
}

export type DemoDataResetReport = {
  dryRun: boolean
  organizationId: string
  hostelId?: string | null
  rows: Record<string, number>
  deletedRows: Record<string, number>
  authUsers: DemoDataResetAuthUser[]
  storageObjects: DemoDataResetStorageObject[]
  preserved: string[]
  warnings: string[]
  confirmationRequired: string
  sequencesReset: string[]
  auditId?: string | null
  executedAt?: string | null
  storageDeleted?: number
  authUsersDeleted?: number
}

export type IdentityRepairAction =
  | "delete_orphan_auth"
  | "relink_resident"
  | "reset_onboarding"
  | "dedupe_identity"
  | "review_manually"

export type IdentityReconciliationFinding = {
  id: string
  severity: ConsistencySeverity
  category:
    | "auth_without_resident"
    | "resident_without_auth"
    | "duplicate_phone"
    | "duplicate_alias"
    | "stale_onboarding"
    | "invalid_linkage"
    | "orphan_metadata"
  title: string
  description: string
  authUserId?: string | null
  residentId?: string | null
  organizationId?: string | null
  hostelId?: string | null
  expectedState: string
  actualState: string
  recommendedRepairAction: IdentityRepairAction
  safeAutoRepair: boolean
}

export type IdentityReconciliationReport = {
  organizationId: string
  hostelId?: string | null
  generatedAt: string
  scannedAuthUsers: number
  findings: IdentityReconciliationFinding[]
  summaries: {
    critical: number
    high: number
    medium: number
    low: number
    informational: number
    totalFindings: number
    safeAutoRepairs: number
  }
}

export type IdentityRepairResult = {
  dryRun: boolean
  deletedAuthUsers: number
  repairedResidents: number
  warnings: string[]
  report: IdentityReconciliationReport
}

export type FinancialReconciliationCounts = {
  verified_payments_missing_invoice: number
  verified_payments_missing_receipt: number
  paid_zero_balance_fee_records_missing_invoice: number
  verified_receipt_documents_missing_invoice_link: number
  paid_invoice_payment_total_mismatch: number
}

export type FinancialReconciliationRepairReport = {
  dryRun: boolean
  organizationId: string
  hostelId?: string | null
  before: FinancialReconciliationCounts
  after: FinancialReconciliationCounts
  repairs: Record<string, unknown>
  message: string
}

export type MissingReceiptRepairReport = {
  dryRun: boolean
  organizationId: string
  hostelId?: string | null
  before: FinancialReconciliationCounts
  after: FinancialReconciliationCounts
  candidates: number
  receiptsGenerated: number
  skippedExisting: number
  message: string
}
