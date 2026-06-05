import { afterEach, describe, expect, it, vi } from "vitest"

import { createGetRequest } from "@/tests/helpers"

describe("financial consistency report route", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/operations")
  })

  it("downloads financial consistency findings as CSV", async () => {
    const getReport = vi.fn().mockResolvedValue({
      findings: [
        {
          id: "finance.verified_payment_missing_invoice",
          severity: "critical",
          title: "Verified payments are missing invoices",
          count: 1,
          repairAction: "repair_financial_reconciliation",
          details: [
            {
              tableName: "payments",
              recordId: "payment-1",
              anomalyType: "verified_payment_missing_invoice",
              recommendation: "Run financial reconciliation.",
            },
          ],
        },
        {
          id: "uploads.stale_pending",
          severity: "medium",
          title: "Stale uploads",
          count: 1,
          repairAction: "cleanup_uploads",
          details: [],
        },
      ],
    })

    vi.doMock("@/services/operations", () => ({
      ConsistencyService: {
        create: vi.fn().mockResolvedValue({ getReport }),
      },
    }))

    const { GET } = await import("@/app/api/operations/financial-consistency/report/route")
    const response = await GET(createGetRequest("/api/operations/financial-consistency/report"))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/csv")
    expect(csv).toContain("finance.verified_payment_missing_invoice")
    expect(csv).toContain("payment-1")
    expect(csv).not.toContain("uploads.stale_pending")
  })
})
