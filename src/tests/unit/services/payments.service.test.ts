import { describe, expect, it, vi } from "vitest"

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

function createServiceHarness() {
  const service = new PaymentsService({} as never)
  const authService = {
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
    getCurrentContext: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
    requireHostelAccess: vi.fn(),
  }
  const paymentSettingsRepository = {
    getActive: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue({ id: "audit-log-id" }),
  }
  const paymentsRepository = {
    getById: vi.fn(),
    verify: vi.fn(),
    reject: vi.fn(),
    createResidentUpiDraft: vi.fn(),
    finalizeSubmission: vi.fn(),
    updateInvoiceLink: vi.fn(),
  }
  const uploadsRepository = {
    findLatestPaymentProof: vi.fn(),
    uploadObject: vi.fn(),
    createSignedUrl: vi.fn(),
  }
  const residentsRepository = {
    getById: vi.fn().mockResolvedValue(null),
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
    generatePaymentReceiptInvoice: vi.fn(),
  }

  Object.assign(service, {
    authService,
    paymentSettingsRepository,
    paymentsRepository,
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
    uploadsRepository,
    uploadsService,
    residentsRepository,
    invoicesService,
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

describe("PaymentsService", () => {
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

  it("allows residents to submit payment proof before profile completion", async () => {
    const harness = createServiceHarness()
    const context = residentAuthContext()
    const file = new File(["proof"], "payment-proof.png", { type: "image/png" })
    const draftPayment = paymentFixture({
      amount: 10,
      status: "initiated",
      monthly_fee_record_id: FEE_RECORD_ID,
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
