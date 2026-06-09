import type { Json } from "@/types/database"

export type AdvanceDepositStatus = "received" | "voided"
export type AdvanceAllocationStatus = "applied" | "reversed"
export type AdvanceRefundStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled"
export type AdvancePaymentMode = "upi" | "bank_transfer" | "cash"

export type AdvancePaymentDepositRow = {
  id: string
  organization_id: string
  hostel_id: string
  resident_id: string
  payment_id: string | null
  amount: number
  payment_mode: AdvancePaymentMode
  transaction_id: string | null
  received_date: string
  received_by: string | null
  notes: string | null
  status: AdvanceDepositStatus
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type AdvancePaymentAllocationRow = {
  id: string
  organization_id: string
  hostel_id: string
  resident_id: string
  deposit_id: string | null
  monthly_fee_record_id: string
  period_month: string
  amount: number
  allocation_status: AdvanceAllocationStatus
  allocated_at: string
  allocated_by: string | null
  reversal_reason: string | null
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type AdvancePaymentRefundRow = {
  id: string
  organization_id: string
  hostel_id: string
  resident_id: string
  amount: number
  reason: string
  status: AdvanceRefundStatus
  requested_by: string | null
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  notes: string | null
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type AdvanceRefundAuditLogRow = {
  id: string
  organization_id: string
  hostel_id: string | null
  resident_id: string | null
  refund_id: string
  actor_user_id: string | null
  action: string
  old_status: string | null
  new_status: string | null
  notes: string | null
  metadata: Json
  created_at: string
}

export type AdvanceBalanceSnapshot = {
  totalAdvanceReceived: number
  totalAdvanceConsumed: number
  totalAdvanceRefunded: number
  remainingAdvanceBalance: number
}

export type AdvanceCoverageMonth = {
  periodMonth: string
  label: string
  requiredAmount: number
  coveredAmount: number
  outstandingAmount: number
  status: "covered" | "partial" | "uncovered"
}

export type AdvanceCoverageTimeline = {
  balance: AdvanceBalanceSnapshot
  coveredMonths: AdvanceCoverageMonth[]
  coveredUntil: string | null
  nextDueDate: string | null
}

export type AdvanceLedgerResident = {
  id: string
  full_name: string
  hostel_id: string
  monthly_fee_amount: number
  joined_on: string | null
  status?: string | null
  checkout_on?: string | null
}

export type AdvanceFeeRecord = {
  id: string
  organization_id: string
  hostel_id: string
  resident_id: string
  period_month: string
  due_date: string
  total_amount: number
  paid_amount: number
  balance_amount: number
  advance_adjustment_amount: number
  status: string
}

export type AdvanceAllocationPlanItem = {
  monthlyFeeRecordId: string
  periodMonth: string
  dueDate: string
  beforeBalance: number
  allocationAmount: number
  afterBalance: number
  status: "covered" | "partial"
}

export type AdvanceAllocationPlan = {
  startingBalance: number
  consumedAmount: number
  endingBalance: number
  items: AdvanceAllocationPlanItem[]
}

export type AdvanceLedgerSummary = {
  resident: AdvanceLedgerResident
  balance: AdvanceBalanceSnapshot
  coveredMonths: AdvanceCoverageMonth[]
  coveredUntil: string | null
  nextDueDate: string | null
  deposits: AdvancePaymentDepositRow[]
  allocations: AdvancePaymentAllocationRow[]
  refunds: AdvancePaymentRefundRow[]
}

export type AdvanceLiabilityReportRow = {
  residentId: string
  residentName: string
  hostelId: string
  totalAdvanceReceived: number
  totalAdvanceConsumed: number
  totalAdvanceRefunded: number
  remainingAdvanceBalance: number
  coveredUntil: string | null
}

export type AdvanceAgingBucket = {
  label: string
  minDays: number
  maxDays: number | null
  residentCount: number
  amount: number
}

export type AdvanceUtilizationReportRow = {
  month: string
  consumedAmount: number
  allocationCount: number
}

export type AdvanceRefundReportRow = {
  refundId: string
  residentId: string
  residentName: string
  amount: number
  status: AdvanceRefundStatus
  reason: string
  requestedAt: string
  approvedAt: string | null
  paidAt: string | null
}

export type AdvanceReports = {
  liability: AdvanceLiabilityReportRow[]
  aging: AdvanceAgingBucket[]
  utilization: AdvanceUtilizationReportRow[]
  refunds: AdvanceRefundReportRow[]
}

export type AdvanceOwnerDashboard = {
  totalAdvanceLiability: number
  residentsCoveredByAdvance: number
  upcomingAdvanceExpiry: Array<{
    residentId: string
    residentName: string
    coveredUntil: string | null
    remainingAdvanceBalance: number
  }>
}
