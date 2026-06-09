import { afterEach, describe, expect, it, vi } from "vitest"

import { PaymentsService } from "@/services/payments.service"
import {
  FEE_RECORD_ID,
  PAYMENT_ID,
  paymentFixture,
  RESIDENT_ID,
  residentFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext, residentAuthContext } from "@/tests/helpers"
import type { PaymentSettingRow } from "@/types/payment-operations"
import type { Tables } from "@/types/database"

function createServiceHarness() {
  const service = new PaymentsService({} as never)
  const authService = {
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
    getCurrentContext: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
    requireHostelAccess: vi.fn(),
    resolveHostelScope: vi.fn((_context, _organizationId, hostelId?: string) => hostelId),
  }
  const paymentSettingsRepository = {
    getActive: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue({ id: "audit-log-id" }),
  }
  const paymentsRepository = {
    getById: vi.fn(),
    create: vi.fn(),
    verify: vi.fn(),
    reject: vi.fn(),
    createResidentUpiDraft: vi.fn(),
    finalizeSubmission: vi.fn(),
    updateInvoiceLink: vi.fn(),
    markInvoiceFinalizationInProgress: vi.fn().mockResolvedValue(null),
    markInvoiceFinalizationSucceeded: vi.fn(),
    markInvoiceFinalizationFailed: vi.fn().mockResolvedValue(null),
    listPaymentsNeedingInvoiceFinalization: vi.fn(),
    findByIdempotencyKey: vi.fn(),
    findFeeRecordByResidentPeriod: vi.fn(),
    createFeeRecord: vi.fn(),
    updateFeeRecord: vi.fn(),
    getFeeRecordById: vi.fn(),
    listFeeRecords: vi.fn(),
    listResidentPayments: vi.fn(),
    listResidentInvoices: vi.fn(),
  }
  const systemPaymentsRepository = {
    findFeeRecordByResidentPeriod: vi.fn(),
    createFeeRecord: vi.fn(),
    updateFeeRecord: vi.fn(),
  }
  const uploadsRepository = {
    findLatestPaymentProof: vi.fn(),
    uploadObject: vi.fn(),
    createDocument: vi.fn(),
    createSignedUrl: vi.fn(),
    updateDocument: vi.fn(),
  }
  const residentsRepository = {
    getById: vi.fn().mockResolvedValue(null),
    getByUserId: vi.fn().mockResolvedValue(null),
  }
  const realtimeService = {
    paymentStatusChanged: vi.fn().mockResolvedValue(null),
  }
  const notificationService = {
    queue: vi.fn(),
    send: vi.fn(),
  }
  const uploadsService = {
    uploadPaymentProof: vi.fn(),
  }
  const invoicesService = {
    generateMonthlyFeeInvoice: vi.fn(),
    generateVerifiedMonthlyFeePaymentInvoice: vi.fn(),
    generatePaymentReceiptInvoice: vi.fn(),
  }

  Object.assign(service, {
    authService,
    paymentSettingsRepository,
    paymentsRepository,
    systemPaymentsRepository,
    uploadsRepository,
    residentsRepository,
    realtimeService,
    notificationService,
    uploadsService,
    invoicesService,
  })

  return {
    service,
    authService,
    paymentSettingsRepository,
    paymentsRepository,
    systemPaymentsRepository,
    uploadsRepository,
    uploadsService,
    residentsRepository,
    invoicesService,
    notificationService,
  }
}

function paymentSettingFixture(
  overrides: Partial<PaymentSettingRow> = {}
): PaymentSettingRow {
  return {
    id: "00000000-0000-4000-8000-000000000080",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    payment_method: "upi",
    account_name: "Sadhana Boys Hostel",
    upi_id: "sadhanahostel@ibl",
    qr_image_path: `${TEST_ORGANIZATION_ID}/payment-settings/qr/${TEST_HOSTEL_ID}/current.png`,
    bank_name: null,
    branch_name: null,
    account_last4: null,
    is_active: true,
    supports_manual_verification: true,
    instructions: null,
    require_utr: true,
    require_screenshot: true,
    allow_partial_payment: true,
    allow_advance_payment: true,
    auto_expire_pending_payments: true,
    min_payment_amount: 1,
    utr_regex: "^[A-Z0-9][A-Z0-9._/-]{5,63}$",
    duplicate_detection_strictness: "strict",
    version: 4,
    rotated_from_setting_id: null,
    activated_at: "2026-05-24T00:00:00.000Z",
    deactivated_at: null,
    qr_version: 3,
    qr_replaced_at: "2026-05-24T01:00:00.000Z",
    metadata: {},
    created_at: "2026-05-24T00:00:00.000Z",
    updated_at: "2026-05-24T01:00:00.000Z",
    created_by: adminAuthContext().authUser.id,
    updated_by: adminAuthContext().authUser.id,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

function monthlyFeeRecordFixture(
  overrides: Partial<Tables<"monthly_fee_records">> = {}
): Tables<"monthly_fee_records"> {
  return {
    id: FEE_RECORD_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: RESIDENT_ID,
    room_allocation_id: null,
    period_month: "2026-06-01",
    due_date: "2026-06-01",
    base_amount: 6500,
    advance_adjustment_amount: 0,
    discount_amount: 0,
    penalty_amount: 0,
    adjustment_amount: 0,
    total_amount: 6500,
    paid_amount: 0,
    balance_amount: 6500,
    status: "pending",
    generated_at: "2026-06-04T00:00:00.000Z",
    notes: null,
    metadata: {},
    is_active: true,
    created_at: "2026-06-04T00:00:00.000Z",
    updated_at: "2026-06-04T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

describe("PaymentsService", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it("returns a matching UPI idempotency retry before stale pending balance checks", async () => {
    const harness = createServiceHarness()
    const existing = paymentFixture({
      idempotency_key: "resident-upi-payment-test",
      monthly_fee_record_id: FEE_RECORD_ID,
      transaction_id: "UPI-EXISTING-123",
      amount: 6500,
      status: "pending",
    })

    harness.residentsRepository.getById.mockResolvedValue(residentFixture())
    harness.paymentsRepository.findByIdempotencyKey.mockResolvedValue(existing)

    await expect(
      harness.service.createUpiPayment({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        monthlyFeeRecordId: FEE_RECORD_ID,
        amount: 6500,
        method: "upi",
        transactionId: "UPI-EXISTING-123",
        idempotencyKey: "resident-upi-payment-test",
      })
    ).resolves.toEqual(existing)

    expect(harness.paymentSettingsRepository.getActive).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.listResidentPayments).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.createResidentUpiDraft).not.toHaveBeenCalled()
  })

  it("rejects UPI idempotency keys reused for a different payment", async () => {
    const harness = createServiceHarness()
    const existing = paymentFixture({
      idempotency_key: "resident-upi-payment-test",
      monthly_fee_record_id: FEE_RECORD_ID,
      transaction_id: "UPI-EXISTING-123",
      amount: 2500,
      status: "pending",
    })

    harness.residentsRepository.getById.mockResolvedValue(residentFixture())
    harness.paymentsRepository.findByIdempotencyKey.mockResolvedValue(existing)

    await expect(
      harness.service.createUpiPayment({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        monthlyFeeRecordId: FEE_RECORD_ID,
        amount: 6500,
        method: "upi",
        transactionId: "UPI-EXISTING-123",
        idempotencyKey: "resident-upi-payment-test",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This payment idempotency key is already used for a different payment.",
    })

    expect(harness.paymentSettingsRepository.getActive).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.createResidentUpiDraft).not.toHaveBeenCalled()
  })

  it("rejects legacy payment-create idempotency keys reused for different details", async () => {
    const harness = createServiceHarness()
    const existing = paymentFixture({
      idempotency_key: "legacy-payment-create-test",
      transaction_id: "UPI-MANUAL-001",
      amount: 2500,
      status: "pending",
    })

    harness.residentsRepository.getById.mockResolvedValue(residentFixture())
    harness.paymentsRepository.findByIdempotencyKey.mockResolvedValue(existing)

    await expect(
      harness.service.recordManualPayment({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        amount: 6500,
        method: "upi",
        transactionId: "UPI-MANUAL-001",
        idempotencyKey: "legacy-payment-create-test",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This payment idempotency key is already used for a different payment.",
    })

    expect(harness.paymentSettingsRepository.getActive).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.create).not.toHaveBeenCalled()
  })

  it("short-circuits already finalized verified payments without duplicate invoice work", async () => {
    const harness = createServiceHarness()
    const finalized = paymentFixture({
      status: "verified",
      invoice_id: "00000000-0000-4000-8000-000000000155",
      invoice_finalization_status: "succeeded",
      invoice_finalized_at: "2026-06-04T12:00:00.000Z",
    })

    harness.paymentsRepository.getById.mockResolvedValue(finalized)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).resolves.toEqual(finalized)

    expect(harness.paymentsRepository.markInvoiceFinalizationInProgress).not.toHaveBeenCalled()
    expect(harness.invoicesService.generatePaymentReceiptInvoice).not.toHaveBeenCalled()
    expect(harness.invoicesService.generateVerifiedMonthlyFeePaymentInvoice).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.updateInvoiceLink).not.toHaveBeenCalled()
  })

  it("reconciles an already verified payment by ensuring receipt invoice linkage", async () => {
    const harness = createServiceHarness()
    const verified = paymentFixture({ status: "verified", is_advance: true })
    const linked = paymentFixture({
      ...verified,
      invoice_id: "00000000-0000-4000-8000-000000000155",
    })

    harness.paymentsRepository.getById.mockResolvedValue(verified)
    harness.invoicesService.generatePaymentReceiptInvoice.mockResolvedValue({
      id: linked.invoice_id,
    })
    harness.paymentsRepository.updateInvoiceLink.mockResolvedValue(linked)
    harness.paymentsRepository.markInvoiceFinalizationSucceeded.mockResolvedValue(linked)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).resolves.toEqual(linked)

    expect(harness.paymentsRepository.verify).not.toHaveBeenCalled()
    expect(harness.invoicesService.generatePaymentReceiptInvoice).toHaveBeenCalledWith({
      payment: verified,
      actorUserId: adminAuthContext().authUser.id,
    })
    expect(harness.paymentsRepository.updateInvoiceLink).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      linked.invoice_id,
      adminAuthContext().authUser.id
    )
  })

  it("delegates pending payment verification and links a receipt invoice", async () => {
    const harness = createServiceHarness()
    const verified = paymentFixture({ status: "verified", is_advance: true })
    const linked = paymentFixture({
      ...verified,
      invoice_id: "00000000-0000-4000-8000-000000000155",
    })

    harness.paymentsRepository.getById.mockResolvedValue(paymentFixture())
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue({
      resident_id: paymentFixture().resident_id,
    })
    harness.paymentsRepository.verify.mockResolvedValue(verified)
    harness.invoicesService.generatePaymentReceiptInvoice.mockResolvedValue({
      id: linked.invoice_id,
    })
    harness.paymentsRepository.updateInvoiceLink.mockResolvedValue(linked)
    harness.paymentsRepository.markInvoiceFinalizationSucceeded.mockResolvedValue(linked)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).resolves.toEqual(linked)

    expect(harness.paymentsRepository.verify).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id,
      undefined
    )
    expect(harness.invoicesService.generatePaymentReceiptInvoice).toHaveBeenCalledWith({
      payment: verified,
      actorUserId: adminAuthContext().authUser.id,
    })
    expect(harness.paymentsRepository.updateInvoiceLink).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      linked.invoice_id,
      adminAuthContext().authUser.id
    )
  })

  it("keeps atomically linked receipt invoices instead of relinking after verification", async () => {
    const harness = createServiceHarness()
    const linked = paymentFixture({
      status: "verified",
      is_advance: true,
      invoice_id: "00000000-0000-4000-8000-000000000188",
    })

    harness.paymentsRepository.getById.mockResolvedValueOnce(paymentFixture()).mockResolvedValue(linked)
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue({
      resident_id: paymentFixture().resident_id,
    })
    harness.paymentsRepository.verify.mockResolvedValue(linked)
    harness.invoicesService.generatePaymentReceiptInvoice.mockResolvedValue({
      id: linked.invoice_id,
    })
    harness.paymentsRepository.markInvoiceFinalizationSucceeded.mockResolvedValue(linked)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).resolves.toEqual(linked)

    expect(harness.paymentsRepository.verify).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id,
      undefined
    )
    expect(harness.invoicesService.generatePaymentReceiptInvoice).toHaveBeenCalledWith({
      payment: linked,
      actorUserId: adminAuthContext().authUser.id,
    })
    expect(harness.paymentsRepository.updateInvoiceLink).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.markInvoiceFinalizationSucceeded).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id
    )
  })

  it("fails payment verification when receipt invoice generation fails", async () => {
    const harness = createServiceHarness()
    const verified = paymentFixture({ status: "verified", is_advance: true })
    const invoiceError = new Error("invoice storage unavailable")

    harness.paymentsRepository.getById.mockResolvedValue(paymentFixture())
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue({
      resident_id: paymentFixture().resident_id,
    })
    harness.paymentsRepository.verify.mockResolvedValue(verified)
    harness.invoicesService.generatePaymentReceiptInvoice.mockRejectedValue(invoiceError)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).rejects.toThrow("invoice storage unavailable")

    expect(harness.paymentsRepository.updateInvoiceLink).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.markInvoiceFinalizationFailed).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      "invoice storage unavailable",
      adminAuthContext().authUser.id
    )
  })

  it("fails finalization when verification still leaves invoice_id null", async () => {
    const harness = createServiceHarness()
    const verified = paymentFixture({ status: "verified", is_advance: true, invoice_id: null })

    harness.paymentsRepository.getById.mockResolvedValue(paymentFixture())
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue({
      resident_id: paymentFixture().resident_id,
    })
    harness.paymentsRepository.verify.mockResolvedValue(verified)
    harness.invoicesService.generatePaymentReceiptInvoice.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000189",
    })
    harness.paymentsRepository.updateInvoiceLink.mockResolvedValue(verified)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).rejects.toThrow("Verified payment must be linked to an invoice")

    expect(harness.paymentsRepository.markInvoiceFinalizationFailed).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      "Verified payment must be linked to an invoice before finalization succeeds.",
      adminAuthContext().authUser.id
    )
    expect(harness.paymentsRepository.markInvoiceFinalizationSucceeded).not.toHaveBeenCalled()
  })

  it("reconciles an already verified monthly payment by linking its invoice PDF", async () => {
    const harness = createServiceHarness()
    const verified = paymentFixture({
      status: "verified",
      monthly_fee_record_id: FEE_RECORD_ID,
      is_advance: false,
      invoice_id: null,
    })
    const linked = paymentFixture({
      ...verified,
      invoice_id: "00000000-0000-4000-8000-000000000166",
    })

    harness.paymentsRepository.getById.mockResolvedValue(verified)
    harness.invoicesService.generateVerifiedMonthlyFeePaymentInvoice.mockResolvedValue({
      id: linked.invoice_id,
    })
    harness.paymentsRepository.updateInvoiceLink.mockResolvedValue(linked)
    harness.paymentsRepository.markInvoiceFinalizationSucceeded.mockResolvedValue(linked)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).resolves.toEqual(linked)

    expect(harness.paymentsRepository.verify).not.toHaveBeenCalled()
    expect(
      harness.invoicesService.generateVerifiedMonthlyFeePaymentInvoice
    ).toHaveBeenCalledWith({
      payment: verified,
      actorUserId: adminAuthContext().authUser.id,
    })
    expect(harness.invoicesService.generatePaymentReceiptInvoice).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.updateInvoiceLink).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      linked.invoice_id,
      adminAuthContext().authUser.id
    )
  })

  it("requires payment proof before verification", async () => {
    const harness = createServiceHarness()

    harness.paymentsRepository.getById.mockResolvedValue(paymentFixture())
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue(null)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Payment proof is required before verification.",
    })

    expect(harness.paymentsRepository.verify).not.toHaveBeenCalled()
  })

  it("generates manual monthly fees from resident monthly fee amount", async () => {
    const harness = createServiceHarness()
    const resident = residentFixture({ monthly_fee_amount: 7250 })
    const created = monthlyFeeRecordFixture({
      base_amount: 7250,
      total_amount: 7350,
      balance_amount: 7350,
      penalty_amount: 100,
    })

    harness.residentsRepository.getById.mockResolvedValue(resident)
    harness.paymentsRepository.findFeeRecordByResidentPeriod.mockResolvedValue(null)
    harness.paymentsRepository.createFeeRecord.mockResolvedValue(created)

    await expect(
      harness.service.generateMonthlyFee({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        periodMonth: "2026-06-01",
        dueDate: "2026-06-10",
        penaltyAmount: 100,
        adjustmentReason: "Late payment penalty approved by finance.",
      })
    ).resolves.toEqual(created)

    expect(harness.paymentsRepository.createFeeRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        base_amount: 7250,
        total_amount: 7350,
        balance_amount: 7350,
        metadata: expect.objectContaining({
          derived_from_resident_monthly_fee_amount: true,
          resident_monthly_fee_amount: 7250,
          adjustment_reason: "Late payment penalty approved by finance.",
        }),
      })
    )
  })

  it("marks in-person receipt proof verified only after payment verification succeeds", async () => {
    const harness = createServiceHarness()
    const pendingPayment = paymentFixture({
      method: "cash",
      status: "pending",
      monthly_fee_record_id: FEE_RECORD_ID,
    })
    const verified = paymentFixture({
      ...pendingPayment,
      status: "verified",
      verified_at: "2026-06-04T12:00:00.000Z",
    })
    const linked = paymentFixture({
      ...verified,
      invoice_id: "00000000-0000-4000-8000-000000000177",
    })

    harness.residentsRepository.getById.mockResolvedValue(residentFixture())
    harness.paymentsRepository.findByIdempotencyKey.mockResolvedValue(null)
    harness.paymentsRepository.create.mockResolvedValue(pendingPayment)
    harness.paymentsRepository.listResidentPayments.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
    })
    harness.paymentsRepository.getFeeRecordById.mockResolvedValue(monthlyFeeRecordFixture())
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue(null)
    harness.uploadsRepository.createDocument.mockResolvedValue({
      id: "manual-proof-id",
      status: "pending",
    })
    harness.paymentsRepository.verify.mockResolvedValue(verified)
    harness.invoicesService.generateVerifiedMonthlyFeePaymentInvoice.mockResolvedValue({
      id: linked.invoice_id,
    })
    harness.paymentsRepository.updateInvoiceLink.mockResolvedValue(linked)
    harness.paymentsRepository.markInvoiceFinalizationSucceeded.mockResolvedValue(linked)

    await expect(
      harness.service.recordInPersonPayment({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        monthlyFeeRecordId: FEE_RECORD_ID,
        amount: 6500,
        method: "cash",
        idempotencyKey: "manual-payment-test",
      })
    ).resolves.toEqual(linked)

    expect(harness.uploadsRepository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        verified_by: null,
        verified_at: null,
      })
    )
    expect(harness.uploadsRepository.updateDocument).toHaveBeenCalledWith(
      "manual-proof-id",
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        status: "verified",
      })
    )
    expect(harness.uploadsRepository.updateDocument.mock.invocationCallOrder[0]).toBeGreaterThan(
      harness.paymentsRepository.verify.mock.invocationCallOrder[0]
    )
  })

  it("records UPI counter collections with searchable references and finalized invoices", async () => {
    const harness = createServiceHarness()
    const pendingPayment = paymentFixture({
      method: "upi",
      status: "pending",
      monthly_fee_record_id: FEE_RECORD_ID,
      amount: 3500,
      is_partial: true,
      manual_reference: "upi-counter-123",
      transaction_id: "upi-counter-123",
    })
    const verified = paymentFixture({
      ...pendingPayment,
      status: "verified",
      verified_at: "2026-06-04T12:00:00.000Z",
    })
    const linked = paymentFixture({
      ...verified,
      invoice_id: "00000000-0000-4000-8000-000000000178",
    })

    harness.residentsRepository.getById.mockResolvedValue(residentFixture())
    harness.paymentsRepository.findByIdempotencyKey.mockResolvedValue(null)
    harness.paymentsRepository.create.mockResolvedValue(pendingPayment)
    harness.paymentsRepository.listResidentPayments.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
    })
    harness.paymentsRepository.getFeeRecordById.mockResolvedValue(monthlyFeeRecordFixture())
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue(null)
    harness.uploadsRepository.createDocument.mockResolvedValue({
      id: "manual-upi-proof-id",
      status: "pending",
    })
    harness.paymentsRepository.verify.mockResolvedValue(verified)
    harness.invoicesService.generateVerifiedMonthlyFeePaymentInvoice.mockResolvedValue({
      id: linked.invoice_id,
    })
    harness.paymentsRepository.updateInvoiceLink.mockResolvedValue(linked)
    harness.paymentsRepository.markInvoiceFinalizationSucceeded.mockResolvedValue(linked)

    await expect(
      harness.service.recordInPersonPayment({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        residentId: RESIDENT_ID,
        monthlyFeeRecordId: FEE_RECORD_ID,
        amount: 3500,
        method: "upi",
        isPartial: true,
        manualReference: "upi-counter-123",
        notes: "Counter UPI collection",
        idempotencyKey: "manual-upi-payment-test",
      })
    ).resolves.toEqual(linked)

    expect(harness.paymentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "upi",
        status: "pending",
        amount: 3500,
        is_partial: true,
        transaction_id: "upi-counter-123",
        manual_reference: "upi-counter-123",
        metadata: expect.objectContaining({
          collection_workflow: "finance_collection_center",
          collection_method: "upi",
          manual_entry: true,
        }),
      })
    )
    expect(harness.paymentsRepository.verify).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id,
      "manual-upi-payment-test"
    )
    expect(harness.invoicesService.generateVerifiedMonthlyFeePaymentInvoice).toHaveBeenCalledWith({
      payment: verified,
      actorUserId: adminAuthContext().authUser.id,
    })
    expect(harness.notificationService.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "in_app",
        message: expect.objectContaining({
          title: "Payment received",
          templateKey: "payment_received",
        }),
      })
    )
  })

  it("rejects pending manual payments through the atomic repository function", async () => {
    const harness = createServiceHarness()
    const failed = paymentFixture({
      status: "failed",
      failure_reason: "UTR does not match screenshot.",
    })

    harness.paymentsRepository.getById.mockResolvedValue(paymentFixture())
    harness.paymentsRepository.reject.mockResolvedValue(failed)

    await expect(
      harness.service.rejectPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
        reason: "UTR does not match screenshot.",
      })
    ).resolves.toEqual(failed)

    expect(harness.paymentsRepository.reject).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id,
      "UTR does not match screenshot."
    )
  })

  it("adds a QR cache-busting preview key to signed payment settings URLs", async () => {
    const harness = createServiceHarness()
    const setting = paymentSettingFixture()

    harness.paymentSettingsRepository.getActive.mockResolvedValue(setting)
    harness.uploadsRepository.createSignedUrl.mockResolvedValue(
      "https://storage.test/payment-qr?token=signed"
    )

    await expect(
      harness.service.getActivePaymentSettings({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).resolves.toMatchObject({
      qrImageSignedUrl: expect.stringContaining(
        "https://storage.test/payment-qr?token=signed&qr_version=3&qr_updated=1779584400000"
      ),
      qrImagePreviewError: null,
    })

    expect(harness.uploadsRepository.createSignedUrl).toHaveBeenCalledWith(
      "payment-qr-codes",
      setting.qr_image_path,
      900
    )
  })

  it("blocks payment settings test generation in production before auth", async () => {
    vi.stubEnv("LAUNCH_MODE", "production")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    const harness = createServiceHarness()

    await expect(
      harness.service.testPaymentSettings({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        paymentMethod: "upi",
        accountName: "Sadhana Boys Hostel",
        upiId: "sadhana@upi",
        isActive: true,
        supportsManualVerification: true,
        requireUtr: true,
        requireScreenshot: true,
        allowPartialPayment: true,
        allowAdvancePayment: true,
        autoExpirePendingPayments: true,
        minPaymentAmount: 1,
        utrRegex: "^[A-Z0-9][A-Z0-9._/-]{5,63}$",
        duplicateDetectionStrictness: "strict",
      })
    ).rejects.toThrow(/test payment generation is blocked in production/i)

    expect(harness.authService.requirePermission).not.toHaveBeenCalled()
  })

  it("returns operational QR preview guidance when signed URL creation fails", async () => {
    const harness = createServiceHarness()
    const setting = paymentSettingFixture()

    harness.paymentSettingsRepository.getActive.mockResolvedValue(setting)
    harness.uploadsRepository.createSignedUrl.mockRejectedValue(
      new Error("Storage policy rejected select.")
    )

    await expect(
      harness.service.getActivePaymentSettings({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).resolves.toMatchObject({
      qrImageSignedUrl: null,
      qrImageSignedUrlExpiresAt: null,
      qrImagePreviewError:
        "QR image is saved, but the preview link could not be generated. Retry preview or check storage access.",
    })

    expect(harness.paymentSettingsRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_settings.qr_preview_failed",
        record_id: setting.id,
      })
    )
  })

  it("keeps resident ledger reads pure after ownership is verified", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-04T12:00:00.000Z"))

    const harness = createServiceHarness()
    const context = residentAuthContext()
    const resident = residentFixture({
      user_id: context.authUser.id,
      joined_on: "2026-06-01",
      monthly_fee_amount: 5000,
    })
    const feeRecord = monthlyFeeRecordFixture({
      period_month: "2026-06-01",
      due_date: "2026-06-01",
      base_amount: 5000,
      total_amount: 5000,
      balance_amount: 5000,
    })

    harness.authService.getCurrentContext.mockResolvedValue(context)
    harness.residentsRepository.getByUserId.mockResolvedValue(resident)
    harness.residentsRepository.getById.mockResolvedValue(resident)
    harness.paymentsRepository.listFeeRecords.mockResolvedValue({
      data: [feeRecord],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    })
    harness.paymentsRepository.listResidentPayments.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
    })
    harness.paymentsRepository.listResidentInvoices.mockResolvedValue([])

    const ledger = await harness.service.getResidentLedger({
      organizationId: TEST_ORGANIZATION_ID,
    })

    expect(harness.paymentsRepository.createFeeRecord).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.create).not.toHaveBeenCalled()
    expect(harness.systemPaymentsRepository.findFeeRecordByResidentPeriod).not.toHaveBeenCalled()
    expect(harness.systemPaymentsRepository.createFeeRecord).not.toHaveBeenCalled()
    expect(harness.systemPaymentsRepository.updateFeeRecord).not.toHaveBeenCalled()
    expect(harness.invoicesService.generateMonthlyFeeInvoice).not.toHaveBeenCalled()
    expect(harness.invoicesService.generatePaymentReceiptInvoice).not.toHaveBeenCalled()
    expect(harness.uploadsRepository.createDocument).not.toHaveBeenCalled()
    expect(ledger.billing.generatedCurrentDue).toBe(false)
    expect(ledger.billing.nextDueDate).toBe("2026-07-01")
    expect(ledger.totals.currentDue).toBe(5000)
  })

  it("does not catch up missed monthly dues from a ledger read", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-04T12:00:00.000Z"))

    const harness = createServiceHarness()
    const context = residentAuthContext()
    const resident = residentFixture({
      user_id: context.authUser.id,
      joined_on: "2026-04-01",
      monthly_fee_amount: 5000,
    })
    const aprilPaid = monthlyFeeRecordFixture({
      id: "00000000-0000-4000-8000-000000000141",
      period_month: "2026-04-01",
      due_date: "2026-04-01",
      total_amount: 5000,
      paid_amount: 5000,
      balance_amount: 0,
      status: "paid",
      metadata: {
        source: "resident_quick_admission",
        generated_for_initial_collection: true,
      },
    })

    harness.authService.getCurrentContext.mockResolvedValue(context)
    harness.residentsRepository.getByUserId.mockResolvedValue(resident)
    harness.residentsRepository.getById.mockResolvedValue(resident)
    harness.paymentsRepository.listFeeRecords.mockResolvedValue({
      data: [aprilPaid],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    })
    harness.paymentsRepository.listResidentPayments.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
    })
    harness.paymentsRepository.listResidentInvoices.mockResolvedValue([])

    const ledger = await harness.service.getResidentLedger({
      organizationId: TEST_ORGANIZATION_ID,
    })

    expect(harness.systemPaymentsRepository.findFeeRecordByResidentPeriod).not.toHaveBeenCalled()
    expect(harness.systemPaymentsRepository.createFeeRecord).not.toHaveBeenCalled()
    expect(harness.systemPaymentsRepository.updateFeeRecord).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.createFeeRecord).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.create).not.toHaveBeenCalled()
    expect(harness.invoicesService.generateMonthlyFeeInvoice).not.toHaveBeenCalled()
    expect(harness.uploadsRepository.createDocument).not.toHaveBeenCalled()
    expect(ledger.primaryDueRecord).toBeNull()
    expect(ledger.billing.generatedCurrentDue).toBe(false)
    expect(ledger.billing.nextDueDate).toBe("2026-07-01")
    expect(ledger.totals.currentDue).toBe(0)
  })

  it("allows residents to submit payment proof before profile completion", async () => {
    const harness = createServiceHarness()
    const context = residentAuthContext()
    const file = new File(["proof"], "payment-proof.png", { type: "image/png" })
    const draftPayment = paymentFixture({
      amount: 10,
      status: "initiated",
      monthly_fee_record_id: FEE_RECORD_ID,
      transaction_id: "SCREENSHOT-residentpaymentprooftest",
      is_partial: true,
      created_by: context.authUser.id,
    })
    const submittedPayment = paymentFixture({
      ...draftPayment,
      status: "pending",
    })
    const serviceInternals = harness.service as unknown as {
      assertPaymentSettingPolicy: ReturnType<typeof vi.fn>
      assertResidentPaymentAmount: ReturnType<typeof vi.fn>
    }

    serviceInternals.assertPaymentSettingPolicy = vi.fn().mockResolvedValue(undefined)
    serviceInternals.assertResidentPaymentAmount = vi.fn().mockResolvedValue(undefined)
    harness.authService.getCurrentContext.mockResolvedValue(context)
    harness.residentsRepository.getById.mockResolvedValue(
      residentFixture({
        user_id: context.authUser.id,
        date_of_birth: null,
        permanent_address: null,
        aadhaar_document_id: null,
        profile_image_document_id: null,
        status: "active",
      })
    )
    harness.paymentsRepository.createResidentUpiDraft.mockResolvedValue(draftPayment)
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue(null)
    harness.uploadsService.uploadPaymentProof.mockResolvedValue({
      document: { id: "payment-proof-document-id" },
    })
    harness.paymentsRepository.finalizeSubmission.mockResolvedValue(submittedPayment)

    await expect(
      harness.service.submitUpiPaymentWithProof(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          residentId: RESIDENT_ID,
          monthlyFeeRecordId: FEE_RECORD_ID,
          amount: 10,
          method: "upi",
          isPartial: true,
          idempotencyKey: "resident-payment-proof-test",
        },
        file
      )
    ).resolves.toEqual(submittedPayment)

    expect(harness.paymentsRepository.createResidentUpiDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: RESIDENT_ID,
        monthlyFeeRecordId: FEE_RECORD_ID,
        amount: 10,
        isPartial: true,
        actorUserId: context.authUser.id,
      })
    )
    expect(harness.uploadsService.uploadPaymentProof).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: RESIDENT_ID,
        paymentId: PAYMENT_ID,
      }),
      file
    )
  })

  it("continues an existing screenshot-payment idempotency retry without stale balance failure", async () => {
    const harness = createServiceHarness()
    const context = residentAuthContext()
    const file = new File(["proof"], "payment-proof.png", { type: "image/png" })
    const draftPayment = paymentFixture({
      amount: 10,
      status: "initiated",
      monthly_fee_record_id: FEE_RECORD_ID,
      idempotency_key: "resident-payment-proof-test",
      transaction_id: "SCREENSHOT-RESIDENTPAYMENTPROOFTEST",
      is_partial: true,
      created_by: context.authUser.id,
    })
    const submittedPayment = paymentFixture({
      ...draftPayment,
      status: "pending",
    })

    harness.authService.getCurrentContext.mockResolvedValue(context)
    harness.residentsRepository.getById.mockResolvedValue(
      residentFixture({
        user_id: context.authUser.id,
        status: "active",
      })
    )
    harness.paymentsRepository.findByIdempotencyKey.mockResolvedValue(draftPayment)
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue(null)
    harness.uploadsService.uploadPaymentProof.mockResolvedValue({
      document: { id: "payment-proof-document-id" },
    })
    harness.paymentsRepository.finalizeSubmission.mockResolvedValue(submittedPayment)

    await expect(
      harness.service.submitUpiPaymentWithProof(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          residentId: RESIDENT_ID,
          monthlyFeeRecordId: FEE_RECORD_ID,
          amount: 10,
          method: "upi",
          isPartial: true,
          idempotencyKey: "resident-payment-proof-test",
        },
        file
      )
    ).resolves.toEqual(submittedPayment)

    expect(harness.paymentSettingsRepository.getActive).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.listResidentPayments).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.createResidentUpiDraft).not.toHaveBeenCalled()
    expect(harness.uploadsService.uploadPaymentProof).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: RESIDENT_ID,
        paymentId: PAYMENT_ID,
      }),
      file
    )
  })

  it("uploads QR images to the tenant-scoped current path and audits the replacement", async () => {
    const harness = createServiceHarness()
    const file = new File(["qr"], "qr.png", { type: "image/png" })

    harness.uploadsRepository.createSignedUrl.mockResolvedValue("https://storage.test/signed")

    await expect(
      harness.service.uploadPaymentQr(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
        },
        file,
        { requestId: "request-123" }
      )
    ).resolves.toMatchObject({
      bucketName: "payment-qr-codes",
      storagePath: `${TEST_ORGANIZATION_ID}/payment-settings/qr/${TEST_HOSTEL_ID}/current.png`,
      signedUrl: expect.stringContaining("qr_path="),
      expiresInSeconds: 900,
      signedUrlExpiresAt: expect.any(String),
    })

    expect(harness.uploadsRepository.uploadObject).toHaveBeenCalledWith(
      "payment-qr-codes",
      `${TEST_ORGANIZATION_ID}/payment-settings/qr/${TEST_HOSTEL_ID}/current.png`,
      file,
      {
        upsert: true,
        cacheControl: "60",
      }
    )
    expect(harness.paymentSettingsRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_settings.qr_uploaded",
        table_name: "storage.objects",
        request_id: "request-123",
      })
    )
  })
})
