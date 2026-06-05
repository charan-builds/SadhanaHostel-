import { describe, expect, it, vi } from "vitest"

import { ReportBuilderService } from "@/services/reports"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createQueryRecorder(rows: Array<Record<string, unknown>> = []) {
  const calls: Array<[string, ...unknown[]]> = []
  let rangeCalls = 0
  const query = {
    select: vi.fn((...args: unknown[]) => {
      calls.push(["select", ...args])
      return query
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.push(["eq", ...args])
      return query
    }),
    not: vi.fn((...args: unknown[]) => {
      calls.push(["not", ...args])
      return query
    }),
    is: vi.fn((...args: unknown[]) => {
      calls.push(["is", ...args])
      return query
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.push(["order", ...args])
      return query
    }),
    range: vi.fn((...args: unknown[]) => {
      calls.push(["range", ...args])
      rangeCalls += 1
      if (rangeCalls > 1 || rows.length === 0) {
        return Promise.resolve({ data: [], error: null })
      }

      return Promise.resolve({ data: rows, error: null })
    }),
    gte: vi.fn((...args: unknown[]) => {
      calls.push(["gte", ...args])
      return query
    }),
    lte: vi.fn((...args: unknown[]) => {
      calls.push(["lte", ...args])
      return query
    }),
  }

  return { query, calls }
}

describe("ReportBuilderService", () => {
  it("exports payment revenue reports by verified status and verified_at range", async () => {
    const { query, calls } = createQueryRecorder()
    const db = {
      from: vi.fn(() => query),
    }
    const service = new ReportBuilderService(db as never)

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        resolveHostelScope: vi.fn(() => TEST_HOSTEL_ID),
      },
    })

    const report = await service.build("payments", {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      format: "csv",
      maxRows: 10,
    })

    for await (const row of report.rows) {
      void row
      // Exhaust the async iterable so the query is built.
    }

    expect(db.from).toHaveBeenCalledWith("payments")
    expect(calls).toContainEqual(["eq", "status", "verified"])
    expect(calls).toContainEqual(["not", "verified_at", "is", null])
    expect(calls).toContainEqual(["gte", "verified_at", "2026-06-01T00:00:00.000Z"])
    expect(calls).toContainEqual(["lte", "verified_at", "2026-06-30T23:59:59.999Z"])
    expect(calls).not.toContainEqual(["gte", "created_at", "2026-06-01T00:00:00.000Z"])
  })

  it("exports payment activity reports by created_at when explicitly requested", async () => {
    const { query, calls } = createQueryRecorder()
    const db = {
      from: vi.fn(() => query),
    }
    const service = new ReportBuilderService(db as never)

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        resolveHostelScope: vi.fn(() => TEST_HOSTEL_ID),
      },
    })

    const report = await service.build("payments", {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      dateBasis: "activity",
      format: "csv",
      maxRows: 10,
    })

    for await (const row of report.rows) {
      void row
    }

    expect(calls).toContainEqual(["gte", "created_at", "2026-06-01T00:00:00.000Z"])
    expect(calls).toContainEqual(["lte", "created_at", "2026-06-30T23:59:59.999Z"])
    expect(calls).not.toContainEqual(["eq", "status", "verified"])
  })

  it("includes the full same-day activity export range", async () => {
    const { query, calls } = createQueryRecorder()
    const db = {
      from: vi.fn(() => query),
    }
    const service = new ReportBuilderService(db as never)

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        resolveHostelScope: vi.fn(() => TEST_HOSTEL_ID),
      },
    })

    const report = await service.build("payments", {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      fromDate: "2026-06-05",
      toDate: "2026-06-05",
      dateBasis: "activity",
      format: "csv",
      maxRows: 10,
    })

    for await (const row of report.rows) {
      void row
    }

    expect(calls).toContainEqual(["gte", "created_at", "2026-06-05T00:00:00.000Z"])
    expect(calls).toContainEqual(["lte", "created_at", "2026-06-05T23:59:59.999Z"])
  })

  it("exports monthly fee reports with reconciliation totals", async () => {
    const { query } = createQueryRecorder([
      {
        period_month: "2026-06-01",
        due_date: "2026-06-10",
        resident_id: "resident-1",
        base_amount: 6500,
        discount_amount: 0,
        penalty_amount: 100,
        adjustment_amount: 0,
        advance_adjustment_amount: 0,
        total_amount: 6600,
        paid_amount: 2500,
        balance_amount: 4100,
        status: "partial",
      },
    ])
    const db = {
      from: vi.fn(() => query),
    }
    const service = new ReportBuilderService(db as never)

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        resolveHostelScope: vi.fn(() => TEST_HOSTEL_ID),
      },
    })

    const report = await service.build("monthly_fees", {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      format: "csv",
      maxRows: 10,
    })
    const rows = []

    for await (const row of report.rows) {
      rows.push(row)
    }

    expect(db.from).toHaveBeenCalledWith("monthly_fee_records")
    expect(rows.at(-1)).toMatchObject({
      row_type: "TOTAL",
      total_amount: 6600,
      paid_amount: 2500,
      balance_amount: 4100,
    })
  })

  it("exports invoice reports with reconciliation totals", async () => {
    const { query } = createQueryRecorder([
      {
        issue_date: "2026-06-04",
        due_date: "2026-06-10",
        invoice_number: "SBH-202606-000001",
        resident_id: "resident-1",
        monthly_fee_record_id: "fee-1",
        subtotal_amount: 6500,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 6500,
        paid_amount: 6500,
        balance_amount: 0,
        status: "paid",
        pdf_document_id: "doc-1",
      },
    ])
    const db = {
      from: vi.fn(() => query),
    }
    const service = new ReportBuilderService(db as never)

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        resolveHostelScope: vi.fn(() => TEST_HOSTEL_ID),
      },
    })

    const report = await service.build("invoices", {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      format: "csv",
      maxRows: 10,
    })
    const rows = []

    for await (const row of report.rows) {
      rows.push(row)
    }

    expect(db.from).toHaveBeenCalledWith("invoices")
    expect(rows.at(-1)).toMatchObject({
      row_type: "TOTAL",
      total_amount: 6500,
      paid_amount: 6500,
      balance_amount: 0,
    })
  })

  it("rejects the removed occupancy report type", async () => {
    const service = new ReportBuilderService({} as never)

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        resolveHostelScope: vi.fn(() => TEST_HOSTEL_ID),
      },
    })

    await expect(
      service.build("occupancy", {
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        format: "csv",
      })
    ).rejects.toThrow()
  })
})
