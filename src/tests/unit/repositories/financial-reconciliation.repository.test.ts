import { describe, expect, it, vi } from "vitest"

import { FinancialReconciliationRepository } from "@/repositories/financial-reconciliation.repository"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("FinancialReconciliationRepository", () => {
  it("loads normalized reconciliation counts through the database RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        verified_payments_missing_invoice: 2,
        verified_payments_missing_receipt: 4,
        paid_zero_balance_fee_records_missing_invoice: 1,
        verified_receipt_documents_missing_invoice_link: 3,
        paid_invoice_payment_total_mismatch: 0,
      },
      error: null,
    })
    const repository = new FinancialReconciliationRepository({ rpc } as never)

    await expect(
      repository.getCounts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).resolves.toEqual({
      verified_payments_missing_invoice: 2,
      verified_payments_missing_receipt: 4,
      paid_zero_balance_fee_records_missing_invoice: 1,
      verified_receipt_documents_missing_invoice_link: 3,
      paid_invoice_payment_total_mismatch: 0,
    })

    expect(rpc).toHaveBeenCalledWith("financial_reconciliation_counts", {
      p_organization_id: TEST_ORGANIZATION_ID,
      p_hostel_id: TEST_HOSTEL_ID,
    })
  })

  it("passes dry-run mode to the monthly fee invoice repair RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        dryRun: true,
        candidates: 1,
        invoicesCreated: 0,
        paymentsLinked: 0,
      },
      error: null,
    })
    const repository = new FinancialReconciliationRepository({ rpc } as never)

    await expect(
      repository.repairMonthlyFeeInvoices({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: null,
        actorUserId: "00000000-0000-4000-8000-000000000001",
        dryRun: true,
      })
    ).resolves.toEqual({
      dryRun: true,
      candidates: 1,
      invoicesCreated: 0,
      paymentsLinked: 0,
    })

    expect(rpc).toHaveBeenCalledWith("repair_monthly_fee_invoices_atomic", {
      p_organization_id: TEST_ORGANIZATION_ID,
      p_hostel_id: null,
      p_actor_user_id: "00000000-0000-4000-8000-000000000001",
      p_dry_run: true,
    })
  })

  it("normalizes receipt link repair counts", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        dryRun: false,
        candidates: 2,
        documentsLinked: 2,
      },
      error: null,
    })
    const repository = new FinancialReconciliationRepository({ rpc } as never)

    await expect(
      repository.repairReceiptInvoiceLinks({
        organizationId: TEST_ORGANIZATION_ID,
        dryRun: false,
      })
    ).resolves.toEqual({
      dryRun: false,
      candidates: 2,
      documentsLinked: 2,
    })
  })

  it("lists verified payments missing receipt documents through the database RPC", async () => {
    const payment = {
      id: "00000000-0000-4000-8000-000000000201",
      organization_id: TEST_ORGANIZATION_ID,
      status: "verified",
    }
    const rpc = vi.fn().mockResolvedValue({
      data: [payment],
      error: null,
    })
    const repository = new FinancialReconciliationRepository({ rpc } as never)

    await expect(
      repository.listVerifiedPaymentsMissingReceipts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        limit: 25,
      })
    ).resolves.toEqual([payment])

    expect(rpc).toHaveBeenCalledWith("list_verified_payments_missing_receipts", {
      p_organization_id: TEST_ORGANIZATION_ID,
      p_hostel_id: TEST_HOSTEL_ID,
      p_limit: 25,
    })
  })
})
