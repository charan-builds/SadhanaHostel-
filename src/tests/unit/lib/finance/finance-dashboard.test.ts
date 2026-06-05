import { describe, expect, it } from "vitest"

import {
  buildAgingBuckets,
  buildFinanceTimeline,
  buildResidentFinanceRow,
  groupAttentionQueue,
  summarizeFinanceRows,
} from "@/lib/finance/finance-dashboard"
import type { Tables } from "@/types/database"
import type { ResidentPaymentLedger } from "@/types/payment-operations"

describe("finance dashboard helpers", () => {
  it("classifies overdue residents into attention priority groups", () => {
    const critical = buildResidentFinanceRow(
      resident({ id: "resident-critical", monthly_fee_amount: 5000 }),
      ledger({
        residentId: "resident-critical",
        fullName: "Critical Resident",
        currentDue: 5000,
        overdue: 5000,
        feeRecords: [
          feeRecord({
            id: "fee-critical",
            resident_id: "resident-critical",
            due_date: "2026-04-01",
            balance_amount: 5000,
          }),
        ],
      }),
      "2026-06-05"
    )
    const medium = buildResidentFinanceRow(
      resident({ id: "resident-medium", monthly_fee_amount: 3500 }),
      ledger({
        residentId: "resident-medium",
        fullName: "Medium Resident",
        currentDue: 3500,
        overdue: 3500,
        feeRecords: [
          feeRecord({
            id: "fee-medium",
            resident_id: "resident-medium",
            due_date: "2026-05-25",
            balance_amount: 3500,
          }),
        ],
      }),
      "2026-06-05"
    )

    const groups = groupAttentionQueue([medium, critical])

    expect(critical.priority).toBe("critical")
    expect(critical.riskScore).toBeGreaterThan(medium.riskScore)
    expect(groups.critical).toHaveLength(1)
    expect(groups.medium).toHaveLength(1)
  })

  it("builds payment aging buckets from unpaid fee records", () => {
    const buckets = buildAgingBuckets(
      [
        ledger({
          currentDue: 15_500,
          overdue: 12_000,
          feeRecords: [
            feeRecord({ id: "current", due_date: "2026-06-10", balance_amount: 1000 }),
            feeRecord({ id: "week", due_date: "2026-06-01", balance_amount: 2000 }),
            feeRecord({ id: "mid", due_date: "2026-05-25", balance_amount: 3000 }),
            feeRecord({ id: "month", due_date: "2026-05-10", balance_amount: 4000 }),
            feeRecord({ id: "old", due_date: "2026-04-01", balance_amount: 5500 }),
            feeRecord({
              id: "paid",
              due_date: "2026-04-01",
              balance_amount: 0,
              status: "paid",
            }),
          ],
        }),
      ],
      "2026-06-05"
    )

    expect(buckets).toEqual([
      expect.objectContaining({ key: "current", count: 1, amount: 1000 }),
      expect.objectContaining({ key: "1-7", count: 1, amount: 2000 }),
      expect.objectContaining({ key: "8-15", count: 1, amount: 3000 }),
      expect.objectContaining({ key: "16-30", count: 1, amount: 4000 }),
      expect.objectContaining({ key: "30+", count: 1, amount: 5500 }),
    ])
  })

  it("calculates overdue amount from unpaid fee balances and due dates", () => {
    const row = buildResidentFinanceRow(
      resident(),
      ledger({
        currentDue: 7500,
        overdue: 9999,
        feeRecords: [
          feeRecord({
            id: "past-due-pending",
            status: "pending",
            due_date: "2026-05-20",
            balance_amount: 3500,
          }),
          feeRecord({
            id: "future-pending",
            status: "pending",
            due_date: "2026-06-20",
            balance_amount: 4000,
          }),
        ],
      }),
      "2026-06-05"
    )

    expect(row.overdueAmount).toBe(3500)
    expect(row.daysOverdue).toBe(16)
  })

  it("summarizes expected collection from current-month fee records instead of profile fees", () => {
    const row = buildResidentFinanceRow(
      resident({ monthly_fee_amount: 9999 }),
      ledger({
        currentDue: 4000,
        feeRecords: [
          feeRecord({
            id: "current-month-due",
            period_month: "2026-06-01",
            total_amount: 4000,
            balance_amount: 4000,
          }),
          feeRecord({
            id: "previous-month-due",
            period_month: "2026-05-01",
            total_amount: 3500,
            balance_amount: 3500,
          }),
          feeRecord({
            id: "cancelled-current-month-due",
            period_month: "2026-06-01",
            total_amount: 2500,
            balance_amount: 2500,
            status: "cancelled",
          }),
        ],
      }),
      "2026-06-05"
    )

    expect(summarizeFinanceRows([row], "2026-06-05")).toEqual(
      expect.objectContaining({
        totalExpected: 4000,
        totalPending: 4000,
      })
    )
  })

  it("uses verified_at as the finance revenue date for payment history and timeline order", () => {
    const row = buildResidentFinanceRow(
      resident(),
      ledger({
        payments: [
          payment({
            id: "submitted-first-verified-later",
            amount: 2500,
            created_at: "2026-05-31T18:00:00.000Z",
            verified_at: "2026-06-03T10:00:00.000Z",
          }),
          payment({
            id: "submitted-later-verified-earlier",
            amount: 1500,
            created_at: "2026-06-02T18:00:00.000Z",
            verified_at: "2026-06-01T10:00:00.000Z",
          }),
        ],
      }),
      "2026-06-05"
    )

    const paymentEvents = buildFinanceTimeline([row.ledger])
      .filter((event) => event.id.startsWith("payment:"))

    expect(row.lastPaymentDate).toBe("2026-06-03T10:00:00.000Z")
    expect(row.lastPaymentAmount).toBe(2500)
    expect(paymentEvents.map((event) => event.id)).toEqual([
      "payment:submitted-first-verified-later",
      "payment:submitted-later-verified-earlier",
    ])
  })
})

function resident(overrides: Partial<Tables<"residents">> = {}) {
  return {
    id: overrides.id ?? "resident-1",
    organization_id: "00000000-0000-4000-8000-000000000001",
    hostel_id: "00000000-0000-4000-8000-000000000002",
    user_id: "00000000-0000-4000-8000-000000000003",
    admission_number: "SBH-001",
    full_name: "Test Resident",
    preferred_name: null,
    resident_type: "student",
    gender: null,
    date_of_birth: null,
    phone: "+919999999999",
    email: "resident@example.com",
    aadhaar_last4: null,
    aadhaar_document_id: null,
    profile_image_document_id: null,
    parent_name: null,
    parent_phone: null,
    parent_email: null,
    parent_user_id: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    permanent_address: null,
    status: "active",
    joined_on: "2026-01-01",
    checkout_on: null,
    monthly_fee_amount: overrides.monthly_fee_amount ?? 3500,
    security_deposit_amount: 0,
    notes: null,
    metadata: {},
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  } satisfies Tables<"residents">
}

function ledger(overrides: {
  residentId?: string
  fullName?: string
  currentDue?: number
  overdue?: number
  advanceBalance?: number
  feeRecords?: Tables<"monthly_fee_records">[]
  payments?: Tables<"payments">[]
} = {}): ResidentPaymentLedger {
  return {
    resident: {
      id: overrides.residentId ?? "resident-1",
      full_name: overrides.fullName ?? "Test Resident",
      hostel_id: "00000000-0000-4000-8000-000000000002",
      monthly_fee_amount: 3500,
      joined_on: "2026-01-01",
    },
    totals: {
      currentDue: overrides.currentDue ?? 0,
      overdue: overrides.overdue ?? 0,
      pendingVerification: 0,
      verifiedPaid: 0,
      advanceBalance: overrides.advanceBalance ?? 0,
    },
    billing: {
      joinedOn: "2026-01-01",
      currentPeriodMonth: "2026-06-01",
      currentDueDate: "2026-06-05",
      nextDueDate: "2026-07-05",
      generatedCurrentDue: true,
    },
    primaryDueRecord: overrides.feeRecords?.[0] ?? null,
    feeRecords: overrides.feeRecords ?? [],
    payments: overrides.payments ?? [],
    invoices: [],
  }
}

function feeRecord(overrides: Partial<Tables<"monthly_fee_records">>) {
  return {
    id: overrides.id ?? "fee-1",
    organization_id: "00000000-0000-4000-8000-000000000001",
    hostel_id: "00000000-0000-4000-8000-000000000002",
    resident_id: overrides.resident_id ?? "resident-1",
    room_allocation_id: null,
    period_month: "2026-06-01",
    due_date: overrides.due_date ?? "2026-06-05",
    base_amount: 3500,
    advance_adjustment_amount: 0,
    discount_amount: 0,
    penalty_amount: 0,
    adjustment_amount: 0,
    total_amount: overrides.total_amount ?? overrides.balance_amount ?? 3500,
    paid_amount: 0,
    balance_amount: overrides.balance_amount ?? 3500,
    status: overrides.status ?? "pending",
    generated_at: "2026-06-01T00:00:00.000Z",
    notes: null,
    metadata: {},
    is_active: true,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  } satisfies Tables<"monthly_fee_records">
}

function payment(overrides: Partial<Tables<"payments">> = {}) {
  return {
    id: overrides.id ?? "payment-1",
    organization_id: "00000000-0000-4000-8000-000000000001",
    hostel_id: "00000000-0000-4000-8000-000000000002",
    resident_id: overrides.resident_id ?? "resident-1",
    monthly_fee_record_id: overrides.monthly_fee_record_id ?? null,
    invoice_id: overrides.invoice_id ?? null,
    amount: overrides.amount ?? 3500,
    method: overrides.method ?? "upi",
    status: overrides.status ?? "verified",
    transaction_id: overrides.transaction_id ?? null,
    provider: null,
    provider_reference: null,
    cashfree_order_id: null,
    cashfree_payment_id: null,
    manual_reference: null,
    idempotency_key: null,
    is_partial: overrides.is_partial ?? false,
    is_advance: overrides.is_advance ?? false,
    received_by: null,
    verified_by: null,
    paid_at: overrides.paid_at ?? null,
    verified_at: overrides.verified_at ?? "2026-06-01T00:00:00.000Z",
    failure_reason: null,
    notes: null,
    metadata: {},
    invoice_finalization_status: "not_required",
    invoice_finalization_attempts: 0,
    invoice_finalization_error: null,
    invoice_finalized_at: null,
    lock_version: 0,
    is_active: true,
    created_at: overrides.created_at ?? "2026-06-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-06-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  } satisfies Tables<"payments">
}
