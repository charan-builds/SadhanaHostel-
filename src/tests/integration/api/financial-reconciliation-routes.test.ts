import { afterEach, describe, expect, it, vi } from "vitest"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { createJsonRequest, readApiResponse } from "@/tests/helpers"

describe("financial reconciliation API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/operations")
  })

  it("routes admin financial reconciliation repairs through the service", async () => {
    const repair = vi.fn().mockResolvedValue({
      dryRun: true,
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      before: {
        verified_payments_missing_invoice: 2,
        verified_payments_missing_receipt: 1,
        paid_zero_balance_fee_records_missing_invoice: 1,
        verified_receipt_documents_missing_invoice_link: 2,
        paid_invoice_payment_total_mismatch: 0,
      },
      after: {
        verified_payments_missing_invoice: 2,
        verified_payments_missing_receipt: 1,
        paid_zero_balance_fee_records_missing_invoice: 1,
        verified_receipt_documents_missing_invoice_link: 2,
        paid_invoice_payment_total_mismatch: 0,
      },
      repairs: {},
      message: "Dry run completed. No financial records were changed.",
    })

    vi.doMock("@/services/operations", () => ({
      FinancialReconciliationService: {
        create: vi.fn().mockResolvedValue({ repair }),
      },
    }))

    const { POST } = await import(
      "@/app/api/operations/financial-reconciliation/repair/route"
    )
    const payload = {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      action: "repair_all",
      dryRun: true,
    }
    const response = await POST(
      createJsonRequest("/api/operations/financial-reconciliation/repair", payload)
    )
    const body = await readApiResponse<Awaited<ReturnType<typeof repair>>>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    if (!body.success) {
      throw new Error("Expected financial reconciliation route to succeed.")
    }
    expect(body.data.before.verified_payments_missing_invoice).toBe(2)
    expect(repair).toHaveBeenCalledWith(payload)
  })

  it("routes missing receipt regeneration through the service", async () => {
    const regenerateMissingReceipts = vi.fn().mockResolvedValue({
      dryRun: true,
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      before: {
        verified_payments_missing_invoice: 0,
        verified_payments_missing_receipt: 3,
        paid_zero_balance_fee_records_missing_invoice: 0,
        verified_receipt_documents_missing_invoice_link: 0,
        paid_invoice_payment_total_mismatch: 0,
      },
      after: {
        verified_payments_missing_invoice: 0,
        verified_payments_missing_receipt: 3,
        paid_zero_balance_fee_records_missing_invoice: 0,
        verified_receipt_documents_missing_invoice_link: 0,
        paid_invoice_payment_total_mismatch: 0,
      },
      candidates: 3,
      receiptsGenerated: 0,
      skippedExisting: 0,
      message: "Dry run completed. No receipt documents were generated.",
    })

    vi.doMock("@/services/operations", () => ({
      FinancialReconciliationService: {
        create: vi.fn().mockResolvedValue({ regenerateMissingReceipts }),
      },
    }))

    const { POST } = await import(
      "@/app/api/operations/financial-reconciliation/receipts/route"
    )
    const payload = {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      dryRun: true,
      limit: 25,
    }
    const response = await POST(
      createJsonRequest("/api/operations/financial-reconciliation/receipts", payload)
    )
    const body = await readApiResponse<Awaited<ReturnType<typeof regenerateMissingReceipts>>>(
      response
    )

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    if (!body.success) {
      throw new Error("Expected missing receipt route to succeed.")
    }
    expect(body.data.candidates).toBe(3)
    expect(regenerateMissingReceipts).toHaveBeenCalledWith(payload)
  })
})
