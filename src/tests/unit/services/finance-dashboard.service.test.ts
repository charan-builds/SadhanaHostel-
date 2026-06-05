import { describe, expect, it } from "vitest"

import { buildFinanceDashboardSnapshot } from "@/services/finance-dashboard.service"
import {
  FEE_RECORD_ID,
  OTHER_RESIDENT_ID,
  PAYMENT_ID,
  paymentFixture,
  residentFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import type { Tables } from "@/types/database"

describe("FinanceDashboardService aggregation", () => {
  it("returns all required dashboard sections from one bulk snapshot", () => {
    const dashboard = buildFinanceDashboardSnapshot({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      today: "2026-06-05",
      generatedAt: "2026-06-05T10:00:00.000Z",
      residents: [
        residentFixture({
          id: OTHER_RESIDENT_ID,
          full_name: "High Due Resident",
          admission_number: "SBH-CASH-042",
          phone: "+91 98490 84940",
          monthly_fee_amount: 5000,
        }),
      ],
      feeRecords: [
        feeRecord({
          resident_id: OTHER_RESIDENT_ID,
          total_amount: 5000,
          balance_amount: 5000,
          due_date: "2026-06-01",
          period_month: "2026-06-01",
        }),
      ],
      payments: [
        paymentFixture({
          id: PAYMENT_ID,
          resident_id: OTHER_RESIDENT_ID,
          monthly_fee_record_id: FEE_RECORD_ID,
          amount: 2000,
          method: "cash",
          status: "verified",
          verified_at: "2026-06-05T10:00:00.000Z",
          created_at: "2026-06-02T10:00:00.000Z",
          manual_reference: "CASH-BOOK-042",
          is_partial: true,
        }),
      ],
      invoices: [
        invoiceRecord({
          resident_id: OTHER_RESIDENT_ID,
          invoice_number: "INV-2026-00012",
          status: "paid",
          total_amount: 2000,
          paid_amount: 2000,
          balance_amount: 0,
        }),
      ],
    })

    expect(dashboard).toMatchObject({
      generatedAt: "2026-06-05T10:00:00.000Z",
      kpis: {
        expectedCollection: 5000,
        collectedAmount: 2000,
        pendingAmount: 5000,
        collectionRate: 40,
        residentsWithPending: 1,
        overdueAmount: 5000,
        averageCollectionDelay: 4,
        residentsDueToday: 0,
      },
      queryPlan: {
        bulkQueries: 6,
        residentRows: 1,
        beforeResidentLedgerRequests: 1,
        afterResidentLedgerRequests: 0,
        residentLedgerRequests: 0,
        truncated: false,
        totalRowsScanned: 4,
      },
    })
    expect(dashboard.aggregation).toEqual({
      source: "snapshot",
      truncated: false,
      totalRowsScanned: 4,
    })
    expect(dashboard.summaries.totalAdvance).toBe(0)
    expect(dashboard.dueWindows.week).toBe(0)
    expect(dashboard.agingBuckets).toHaveLength(5)
    expect(dashboard.attention.low).toHaveLength(1)
    expect(dashboard.residentFinance).toHaveLength(1)
    expect(dashboard.residentFinance[0]).not.toHaveProperty("ledger")
    expect(dashboard.residentFinance[0]).toMatchObject({
      primaryDueRecordId: FEE_RECORD_ID,
      primaryDueBalance: 5000,
      primaryDueDate: "2026-06-01",
      invoiceNumbers: ["INV-2026-00012"],
      receiptNumbers: ["INV-2026-00012"],
    })
    expect(dashboard.residentFinance[0].searchIndex).toContain("sbh-cash-042")
    expect(dashboard.residentFinance[0].searchIndex).toContain("98490")
    expect(dashboard.residentFinance[0].searchIndex).toContain("inv-2026-00012")
    expect(dashboard.residentFinance[0].searchIndex).toContain("cash-book-042")
    expect(dashboard.recentPayments).toHaveLength(1)
    expect(dashboard.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Fee generated", kind: "due_generated" }),
        expect.objectContaining({ title: "Cash collected", kind: "cash_collected" }),
        expect.objectContaining({ title: "Receipt generated", kind: "receipt_generated" }),
      ])
    )
    expect(dashboard.owner).toMatchObject({
      summary: {
        revenue: 2000,
        todayRevenue: 2000,
        billed: 5000,
        pendingDues: 5000,
        overdueDues: 5000,
      },
      collectionToday: {
        cash: 2000,
        upi: 0,
        bank: 0,
        total: 2000,
      },
      upcomingDues: {
        next7Days: 0,
        next15Days: 0,
        next30Days: 0,
      },
      highRisk: {
        overdue30Plus: 0,
        overdue60Plus: 0,
        overdue90Plus: 0,
      },
      forecasts: {
        revenue: expect.any(Object),
      },
      insights: expect.any(Array),
    })
  })

  it("records zero resident ledger requests in the dashboard query plan", () => {
    const residents = [
      residentFixture({ id: "00000000-0000-4000-8000-000000000201" }),
      residentFixture({ id: "00000000-0000-4000-8000-000000000202" }),
      residentFixture({ id: "00000000-0000-4000-8000-000000000203" }),
    ]

    const dashboard = buildFinanceDashboardSnapshot({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      today: "2026-06-05",
      residents,
      feeRecords: [],
      payments: [],
      invoices: [],
    })

    expect(dashboard.queryPlan.beforeResidentLedgerRequests).toBe(3)
    expect(dashboard.queryPlan.afterResidentLedgerRequests).toBe(0)
    expect(dashboard.queryPlan.residentLedgerRequests).toBe(0)
  })

  it("uses database aggregate KPI and aging metadata when supplied", () => {
    const dashboard = buildFinanceDashboardSnapshot({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      today: "2026-06-05",
      residents: [residentFixture({ id: OTHER_RESIDENT_ID })],
      feeRecords: [],
      payments: [],
      invoices: [],
      databaseAggregates: {
        kpis: {
          expectedCollection: 10000,
          collectedAmount: 7000,
          pendingAmount: 3000,
          activeResidents: 12,
          residentsWithPending: 4,
          overdueAmount: 1500,
          advanceBalance: 500,
        },
        agingBuckets: [
          { key: "current", label: "Current", count: 1, amount: 100 },
          { key: "1-7", label: "1-7 Days", count: 2, amount: 200 },
          { key: "8-15", label: "8-15 Days", count: 3, amount: 300 },
          { key: "16-30", label: "16-30 Days", count: 4, amount: 400 },
          { key: "30+", label: "30+ Days", count: 5, amount: 500 },
        ],
        metadata: {
          truncated: false,
          totalRowsScanned: 1234,
        },
      },
    })

    expect(dashboard.kpis).toMatchObject({
      expectedCollection: 10000,
      collectedAmount: 7000,
      pendingAmount: 3000,
      collectionRate: 70,
      activeResidents: 12,
      residentsWithPending: 4,
      overdueAmount: 1500,
      advanceBalance: 500,
      averageCollectionDelay: 0,
      residentsDueToday: 0,
    })
    expect(dashboard.agingBuckets[4]).toMatchObject({
      key: "30+",
      count: 5,
      amount: 500,
    })
    expect(dashboard.aggregation).toEqual({
      source: "database",
      truncated: false,
      totalRowsScanned: 1234,
    })
  })
})

function feeRecord(
  overrides: Partial<Tables<"monthly_fee_records">> = {}
): Tables<"monthly_fee_records"> {
  return {
    id: FEE_RECORD_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: OTHER_RESIDENT_ID,
    room_allocation_id: null,
    period_month: "2026-06-01",
    due_date: "2026-06-01",
    base_amount: 5000,
    advance_adjustment_amount: 0,
    discount_amount: 0,
    penalty_amount: 0,
    adjustment_amount: 0,
    total_amount: 5000,
    paid_amount: 0,
    balance_amount: 5000,
    status: "pending",
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
  }
}

function invoiceRecord(
  overrides: Partial<Tables<"invoices">> = {}
): Tables<"invoices"> {
  return {
    id: "00000000-0000-4000-8000-000000000153",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: OTHER_RESIDENT_ID,
    monthly_fee_record_id: null,
    invoice_number: "INV-2026-00001",
    issue_date: "2026-06-05",
    due_date: "2026-06-05",
    subtotal_amount: 2000,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 2000,
    paid_amount: 0,
    balance_amount: 2000,
    status: "issued",
    pdf_document_id: null,
    pdf_storage_path: null,
    cancellation_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    metadata: {},
    is_active: true,
    created_at: "2026-06-05T10:01:00.000Z",
    updated_at: "2026-06-05T10:01:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}
