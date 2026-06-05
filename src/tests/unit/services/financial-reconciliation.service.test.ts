import { afterEach, describe, expect, it, vi } from "vitest"

import { FinancialReconciliationService } from "@/services/operations/financial-reconciliation.service"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

const zeroCounts = {
  verified_payments_missing_invoice: 0,
  verified_payments_missing_receipt: 0,
  paid_zero_balance_fee_records_missing_invoice: 0,
  verified_receipt_documents_missing_invoice_link: 0,
  paid_invoice_payment_total_mismatch: 0,
}

function createRepository() {
  return {
    getCounts: vi
      .fn()
      .mockResolvedValueOnce({
        verified_payments_missing_invoice: 2,
        verified_payments_missing_receipt: 1,
        paid_zero_balance_fee_records_missing_invoice: 1,
        verified_receipt_documents_missing_invoice_link: 2,
        paid_invoice_payment_total_mismatch: 0,
      })
      .mockResolvedValue(zeroCounts),
    repairMonthlyFeeInvoices: vi.fn().mockResolvedValue({
      dryRun: false,
      candidates: 1,
      invoicesCreated: 1,
      paymentsLinked: 1,
    }),
    repairAdvancePaymentInvoices: vi.fn().mockResolvedValue({
      dryRun: false,
      candidates: 1,
      invoicesCreated: 1,
      paymentsLinked: 1,
    }),
    repairReceiptInvoiceLinks: vi.fn().mockResolvedValue({
      dryRun: false,
      candidates: 2,
      documentsLinked: 2,
    }),
    listVerifiedPaymentsMissingReceipts: vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000201",
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: "00000000-0000-4000-8000-000000000301",
        invoice_id: "00000000-0000-4000-8000-000000000401",
        amount: 3500,
        method: "cash",
        manual_reference: null,
      },
    ]),
  }
}

function createInvoicesService(overrides: Partial<{
  repairMissingInvoicePdfs: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    repairMissingInvoicePdfs: vi.fn().mockResolvedValue({
      dryRun: false,
      candidates: 1,
      pdfsGenerated: 1,
      skipped: 0,
      failures: [],
    }),
    ...overrides,
  }
}

describe("FinancialReconciliationService", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("executes reconciliation count RPCs through the admin client after authorization", async () => {
    const userRpc = vi.fn()
    const adminRpc = vi.fn().mockResolvedValue({
      data: zeroCounts,
      error: null,
    })
    const service = new FinancialReconciliationService(
      { rpc: userRpc } as never,
      { rpc: adminRpc } as never
    )
    const context = adminAuthContext()
    const authService = {
      requirePermission: vi.fn().mockResolvedValue(context),
      requireHostelAccess: vi.fn(),
    }

    Object.assign(service, { authService })

    await expect(
      service.getCounts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).resolves.toEqual(zeroCounts)

    expect(authService.requirePermission).toHaveBeenCalledWith("finance.manage")
    expect(authService.requireHostelAccess).toHaveBeenCalledWith(
      context,
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
    expect(adminRpc).toHaveBeenCalledWith("financial_reconciliation_counts", {
      p_organization_id: TEST_ORGANIZATION_ID,
      p_hostel_id: TEST_HOSTEL_ID,
    })
    expect(userRpc).not.toHaveBeenCalled()
  })

  it("runs dry-run repairs without changing after counts", async () => {
    const service = new FinancialReconciliationService({} as never)
    const repository = createRepository()
    const invoicesService = createInvoicesService({
      repairMissingInvoicePdfs: vi.fn().mockResolvedValue({
        dryRun: true,
        candidates: 1,
        pdfsGenerated: 0,
        skipped: 0,
        failures: [],
      }),
    })

    const authService = {
      requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
      requireHostelAccess: vi.fn(),
    }

    Object.assign(service, {
      authService,
      repository,
      invoicesService,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "repair_all",
        dryRun: true,
      })
    ).resolves.toMatchObject({
      dryRun: true,
      before: {
        verified_payments_missing_invoice: 2,
      },
      after: {
        verified_payments_missing_invoice: 2,
      },
      message: expect.stringContaining("Dry run"),
    })

    expect(repository.repairMonthlyFeeInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    )
    expect(authService.requirePermission).toHaveBeenCalledWith("finance.manage")
    expect(repository.repairAdvancePaymentInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    )
    expect(repository.repairReceiptInvoiceLinks).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    )
    expect(invoicesService.repairMissingInvoicePdfs).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      actorUserId: adminAuthContext().authUser.id,
      dryRun: true,
      limit: 500,
    })
    expect(repository.getCounts).toHaveBeenCalledTimes(1)
  })

  it("repairs all financial invoice/link anomalies and returns before and after counts", async () => {
    vi.stubEnv("OPERATIONAL_REPAIRS_ENABLED", "true")

    const service = new FinancialReconciliationService({} as never)
    const repository = createRepository()
    const invoicesService = createInvoicesService()

    const authService = {
      requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
      requireHostelAccess: vi.fn(),
    }

    Object.assign(service, {
      authService,
      repository,
      invoicesService,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "repair_all",
        dryRun: false,
      })
    ).resolves.toMatchObject({
      dryRun: false,
      before: {
        verified_payments_missing_invoice: 2,
        paid_zero_balance_fee_records_missing_invoice: 1,
      },
      after: zeroCounts,
      repairs: {
        monthlyFeeInvoices: { invoicesCreated: 1, paymentsLinked: 1 },
        advancePaymentInvoices: { invoicesCreated: 1, paymentsLinked: 1 },
        receiptInvoiceLinks: { documentsLinked: 2 },
        missingInvoicePdfs: { pdfsGenerated: 1 },
      },
    })

    expect(repository.repairMonthlyFeeInvoices).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      actorUserId: adminAuthContext().authUser.id,
      dryRun: false,
    })
    expect(authService.requirePermission).toHaveBeenCalledWith("settings.manage")
    expect(invoicesService.repairMissingInvoicePdfs).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      actorUserId: adminAuthContext().authUser.id,
      dryRun: false,
      limit: 500,
    })
    expect(repository.getCounts).toHaveBeenCalledTimes(2)
  })

  it("blocks mutating financial repairs when the operational kill switch is disabled", async () => {
    vi.stubEnv("OPERATIONAL_REPAIRS_ENABLED", "false")

    const service = new FinancialReconciliationService({} as never)
    const repository = createRepository()
    const invoicesService = createInvoicesService()

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
      invoicesService,
    })

    await expect(
      service.repair({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        action: "repair_all",
        dryRun: false,
      })
    ).resolves.toMatchObject({
      dryRun: true,
      repairs: {},
      message: expect.stringContaining("OPERATIONAL_REPAIRS_ENABLED=false"),
    })

    expect(repository.repairMonthlyFeeInvoices).not.toHaveBeenCalled()
    expect(repository.repairAdvancePaymentInvoices).not.toHaveBeenCalled()
    expect(repository.repairReceiptInvoiceLinks).not.toHaveBeenCalled()
    expect(invoicesService.repairMissingInvoicePdfs).not.toHaveBeenCalled()
  })

  it("dry-runs missing receipt regeneration without storage or document writes", async () => {
    const service = new FinancialReconciliationService({} as never)
    const repository = createRepository()
    const uploadsRepository = {
      findLatestPaymentProof: vi.fn(),
      uploadObject: vi.fn(),
      createDocument: vi.fn(),
    }

    const authService = {
      requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
      requireHostelAccess: vi.fn(),
    }

    Object.assign(service, {
      authService,
      repository,
      uploadsRepository,
      operationsRepository: {
        createAuditLog: vi.fn(),
      },
    })

    await expect(
      service.regenerateMissingReceipts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: true,
      })
    ).resolves.toMatchObject({
      dryRun: true,
      candidates: 1,
      receiptsGenerated: 0,
    })

    expect(uploadsRepository.uploadObject).not.toHaveBeenCalled()
    expect(uploadsRepository.createDocument).not.toHaveBeenCalled()
    expect(authService.requirePermission).toHaveBeenCalledWith("finance.manage")
  })

  it("generates missing receipt storage objects and verified document records", async () => {
    vi.stubEnv("OPERATIONAL_REPAIRS_ENABLED", "true")

    const service = new FinancialReconciliationService({} as never)
    const repository = createRepository()
    const uploadsRepository = {
      findLatestPaymentProof: vi.fn().mockResolvedValue(null),
      uploadObject: vi.fn().mockResolvedValue({ path: "receipt.png" }),
      createDocument: vi.fn().mockResolvedValue({ id: "receipt-doc-id" }),
    }
    const operationsRepository = {
      createAuditLog: vi.fn().mockResolvedValue({ id: "audit-id" }),
    }

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
      uploadsRepository,
      operationsRepository,
    })

    await expect(
      service.regenerateMissingReceipts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: false,
      })
    ).resolves.toMatchObject({
      dryRun: false,
      candidates: 1,
      receiptsGenerated: 1,
      skippedExisting: 0,
    })

    expect(uploadsRepository.uploadObject).toHaveBeenCalledWith(
      "payment-screenshots",
      expect.stringContaining("manual-payment-receipts"),
      expect.any(File),
      expect.objectContaining({ upsert: true })
    )
    expect(uploadsRepository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        document_type: "payment_receipt",
        status: "verified",
        invoice_id: "00000000-0000-4000-8000-000000000401",
        payment_id: "00000000-0000-4000-8000-000000000201",
      })
    )
    expect(operationsRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "financial_reconciliation.missing_receipts_regenerated",
      })
    )
  })

  it("skips payments that already gained a verified receipt before generation", async () => {
    vi.stubEnv("OPERATIONAL_REPAIRS_ENABLED", "true")

    const service = new FinancialReconciliationService({} as never)
    const repository = createRepository()
    const uploadsRepository = {
      findLatestPaymentProof: vi.fn().mockResolvedValue({ id: "receipt-doc-id", status: "verified" }),
      uploadObject: vi.fn(),
      createDocument: vi.fn(),
    }

    Object.assign(service, {
      authService: {
        requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
        requireHostelAccess: vi.fn(),
      },
      repository,
      uploadsRepository,
      operationsRepository: {
        createAuditLog: vi.fn().mockResolvedValue({ id: "audit-id" }),
      },
    })

    await expect(
      service.regenerateMissingReceipts({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        dryRun: false,
      })
    ).resolves.toMatchObject({
      receiptsGenerated: 0,
      skippedExisting: 1,
    })

    expect(uploadsRepository.uploadObject).not.toHaveBeenCalled()
    expect(uploadsRepository.createDocument).not.toHaveBeenCalled()
  })
})
