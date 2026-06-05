import { afterEach, describe, expect, it, vi } from "vitest"

import { HOSTEL_FEES } from "@/constants/hostel"
import { ResidentsService } from "@/services/residents.service"
import {
  FEE_RECORD_ID,
  paymentFixture,
  residentFixture,
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createServiceHarness() {
  const authService = {
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
    requireHostelAccess: vi.fn(),
    resolveHostelScope: vi.fn((_context, _organizationId, hostelId) => hostelId ?? null),
  }
  const residentsRepository = {
    create: vi.fn(),
    getById: vi.fn(),
    findAdmissionDuplicate: vi.fn().mockResolvedValue(null),
    deactivate: vi.fn(),
    checkout: vi.fn(),
    update: vi.fn().mockImplementation((residentId, organizationId, values) =>
      Promise.resolve(
        residentFixture({
          id: residentId,
          organization_id: organizationId,
          hostel_id: TEST_HOSTEL_ID,
          ...values,
        })
      )
    ),
  }
  const residentInviteService = {
    createResidentInvite: vi.fn().mockResolvedValue({
      invite: {
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: RESIDENT_ID,
      },
      activationLink: "https://example.com/activate",
      loginLink: "https://example.com/resident/login",
      whatsappShareUrl: "https://wa.me/919000000002",
      delivery: {
        emailQueued: false,
        whatsappReady: true,
        accessMode: "activation_link",
        temporaryPassword: null,
      },
    }),
  }
  const operationsRepository = {
    repairResidentLifecycle: vi.fn().mockResolvedValue({
      dryRun: false,
      correlationId: "repair-correlation-1",
      residentId: RESIDENT_ID,
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      authMatchCount: 1,
      selectedAuthUserId: "auth-user-1",
      repairs: {
        expiredInvites: 1,
        duplicateInvitesRevoked: 1,
        staleInvitesRevoked: 0,
        authLinkRepaired: 1,
        profilesSynced: 1,
        rolesSynced: 1,
        onboardingAdvanced: 1,
        allocationsReleased: 0,
        feeRecordsCancelled: 0,
        invoicesCancelled: 0,
        hostelsRecalculated: 0,
      },
      timeline: [
        {
          stage: "resident_locked",
        },
      ],
    }),
  }
  const paymentsRepository = {
    create: vi.fn(),
    createFeeRecord: vi.fn(),
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    findFeeRecordByResidentPeriod: vi.fn().mockResolvedValue(null),
    getById: vi.fn(),
    updateInvoiceLink: vi.fn(),
    updateFeeRecord: vi.fn(),
    verify: vi.fn(),
  }
  const uploadsRepository = {
    findLatestPaymentProof: vi.fn().mockResolvedValue(null),
    uploadObject: vi.fn().mockResolvedValue(null),
    createDocument: vi.fn().mockResolvedValue({ id: "admission-proof-id" }),
    updateDocument: vi.fn().mockResolvedValue({ id: "admission-proof-id" }),
  }
  const realtimeService = {
    paymentStatusChanged: vi.fn(),
    dashboardRefresh: vi.fn(),
  }
  const invoicesService = {
    generatePaymentReceiptInvoice: vi.fn().mockResolvedValue({ id: "invoice-receipt-1" }),
    generateVerifiedMonthlyFeePaymentInvoice: vi.fn().mockResolvedValue({ id: "invoice-fee-1" }),
  }
  const service = new ResidentsService({} as never, {
    authService: authService as never,
    residentsRepository: residentsRepository as never,
    residentInviteService: residentInviteService as never,
    operationsRepository: operationsRepository as never,
    paymentsRepository: paymentsRepository as never,
    uploadsRepository: uploadsRepository as never,
    realtimeService: realtimeService as never,
    invoicesService: invoicesService as never,
  })

  return {
    service,
    authService,
    residentsRepository,
    residentInviteService,
    operationsRepository,
    paymentsRepository,
    uploadsRepository,
    realtimeService,
    invoicesService,
  }
}

function monthlyFeeRecordFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: FEE_RECORD_ID,
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    resident_id: RESIDENT_ID,
    period_month: "2026-05-01",
    due_date: "2026-05-01",
    base_amount: 6500,
    total_amount: 6500,
    paid_amount: 0,
    balance_amount: 6500,
    status: "pending",
    notes: null,
    metadata: {},
    is_active: true,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    adjustment_amount: 0,
    advance_adjustment_amount: 0,
    discount_amount: 0,
    penalty_amount: 0,
    generated_at: "2026-05-01T00:00:00.000Z",
    room_allocation_id: null,
    ...overrides,
  }
}

describe("ResidentsService", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("creates a quick draft resident without storing room assignment metadata", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "draft", joined_on: null })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        admissionNumber: "SBH-T-010",
        fullName: "New Resident",
        phone: "+91 90000 01010",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
      })
    ).resolves.toMatchObject({ resident: draftResident })

    expect(harness.residentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        metadata: expect.objectContaining({
          admission_flow: "quick_admin_create",
          profile_completion_required: true,
          whatsapp_onboarding_ready: true,
        }),
      })
    )
    expect(harness.residentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          requested_room_assignment: expect.anything(),
        }),
      })
    )
    expect(harness.residentInviteService.createResidentInvite).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      residentId: draftResident.id,
      deliveryChannel: "whatsapp",
      expiresInHours: 72,
    })
  })

  it("does not require a room assignment to create a draft resident", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "draft", joined_on: null })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        admissionNumber: "SBH-T-011",
        fullName: "Overflow Resident",
        phone: "+91 90000 01011",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
      })
    ).resolves.toMatchObject({ resident: draftResident })

    expect(harness.residentsRepository.deactivate).not.toHaveBeenCalled()
  })

  it("creates quick draft residents with generated admission numbers", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({
      status: "draft",
      admission_number: "DRAFT-ABC-1234",
      phone: "+91 90000 01012",
      joined_on: null,
    })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Quick Resident",
        phone: "+91 90000 01012",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
      })
    ).resolves.toMatchObject({ resident: draftResident })

    expect(harness.residentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        admission_number: expect.stringMatching(/^DRAFT-/),
        status: "draft",
        phone: "+919000001012",
        metadata: expect.objectContaining({
          admission_flow: "quick_admin_create",
          profile_completion_required: true,
        }),
      })
    )
  })

  it("records previous monthly paid and unpaid status during quick admission", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({
      status: "draft",
      joined_on: "2026-04-01",
    })
    const mayRecord = monthlyFeeRecordFixture({
      id: "fee-record-may",
      period_month: "2026-05-01",
      base_amount: HOSTEL_FEES.student,
      total_amount: HOSTEL_FEES.student,
      balance_amount: HOSTEL_FEES.student,
    })
    const juneRecord = monthlyFeeRecordFixture({
      id: "fee-record-june",
      period_month: "2026-06-01",
      base_amount: HOSTEL_FEES.student,
      total_amount: HOSTEL_FEES.student,
      balance_amount: HOSTEL_FEES.student,
    })
    const mayPayment = paymentFixture({
      id: "payment-may",
      monthly_fee_record_id: "fee-record-may",
      amount: HOSTEL_FEES.student,
      method: "cash",
      status: "pending",
      invoice_id: null,
    })
    const mayPaymentWithInvoice = paymentFixture({
      ...mayPayment,
      status: "verified",
      invoice_id: "invoice-fee-1",
    })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)
    harness.residentsRepository.update.mockResolvedValue(draftResident)
    harness.paymentsRepository.createFeeRecord
      .mockResolvedValueOnce(mayRecord)
      .mockResolvedValueOnce(juneRecord)
    harness.paymentsRepository.create.mockResolvedValue(mayPayment)
    harness.paymentsRepository.verify.mockResolvedValue(mayPaymentWithInvoice)
    harness.paymentsRepository.getById.mockResolvedValue(mayPaymentWithInvoice)

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Existing Resident",
        phone: "+91 90000 01014",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
        joinedOn: "2026-04-01",
        openingMonthlyFees: [
          {
            periodMonth: "2026-05-01",
            status: "paid",
            amount: HOSTEL_FEES.student,
            method: "cash",
          },
          {
            periodMonth: "2026-06-01",
            status: "not_paid",
            amount: HOSTEL_FEES.student,
            method: "cash",
          },
        ],
      })
    ).resolves.toMatchObject({
      resident: draftResident,
      openingMonthFeePayments: [mayPaymentWithInvoice],
    })

    expect(harness.paymentsRepository.createFeeRecord).toHaveBeenCalledTimes(2)
    expect(harness.paymentsRepository.createFeeRecord).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        period_month: "2026-05-01",
        balance_amount: HOSTEL_FEES.student,
        status: "pending",
      })
    )
    expect(harness.paymentsRepository.createFeeRecord).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        period_month: "2026-06-01",
        balance_amount: HOSTEL_FEES.student,
        status: "pending",
      })
    )
    expect(harness.paymentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        monthly_fee_record_id: "fee-record-may",
        amount: HOSTEL_FEES.student,
        method: "cash",
        status: "pending",
        idempotency_key: `resident-admission-opening-month-${draftResident.id}-2026-05-01`,
      })
    )
    expect(harness.uploadsRepository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_id: "payment-may",
        document_type: "payment_receipt",
        status: "pending",
      })
    )
    expect(harness.paymentsRepository.verify).toHaveBeenCalledWith(
      "payment-may",
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id,
      `resident-admission-opening-month-${draftResident.id}-2026-05-01`
    )
    expect(harness.uploadsRepository.updateDocument).toHaveBeenCalledWith(
      "admission-proof-id",
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        status: "verified",
      })
    )
    expect(harness.paymentsRepository.updateFeeRecord).not.toHaveBeenCalled()
    expect(harness.paymentsRepository.updateInvoiceLink).not.toHaveBeenCalled()
  })

  it("marks admission pending_finance when payment creation fails", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "pending_finance" })
    const feeRecord = monthlyFeeRecordFixture()

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)
    harness.residentsRepository.update.mockResolvedValue(
      residentFixture({ id: draftResident.id, status: "pending_finance" })
    )
    harness.paymentsRepository.createFeeRecord.mockResolvedValue(feeRecord)
    harness.paymentsRepository.create.mockRejectedValue(new Error("payment insert failed"))

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Finance Pending Resident",
        phone: "+91 90000 01015",
        residentType: "student",
        monthlyFeeAmount: HOSTEL_FEES.student,
        firstMonthFeeStatus: "paid",
        firstMonthFeeAmount: HOSTEL_FEES.student,
      })
    ).rejects.toThrow("payment insert failed")

    expect(harness.residentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending_finance",
        metadata: expect.objectContaining({
          admission_finance_status: "pending",
        }),
      })
    )
    expect(harness.residentsRepository.update).toHaveBeenCalledWith(
      draftResident.id,
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        status: "pending_finance",
        metadata: expect.objectContaining({
          admission_finance_status: "failed",
          admission_finance_error: "payment insert failed",
        }),
      })
    )
    expect(harness.residentInviteService.createResidentInvite).not.toHaveBeenCalled()
  })

  it("marks admission pending_finance when receipt storage fails", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "pending_finance" })
    const feeRecord = monthlyFeeRecordFixture()
    const pendingPayment = paymentFixture({
      monthly_fee_record_id: feeRecord.id,
      status: "pending",
      invoice_id: null,
    })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)
    harness.paymentsRepository.createFeeRecord.mockResolvedValue(feeRecord)
    harness.paymentsRepository.create.mockResolvedValue(pendingPayment)
    harness.uploadsRepository.uploadObject.mockRejectedValue(new Error("storage failed"))

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Storage Pending Resident",
        phone: "+91 90000 01016",
        residentType: "student",
        monthlyFeeAmount: HOSTEL_FEES.student,
        firstMonthFeeStatus: "paid",
        firstMonthFeeAmount: HOSTEL_FEES.student,
      })
    ).rejects.toThrow("storage failed")

    expect(harness.residentsRepository.update).toHaveBeenCalledWith(
      draftResident.id,
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        status: "pending_finance",
        metadata: expect.objectContaining({
          admission_finance_error: "storage failed",
        }),
      })
    )
    expect(harness.residentInviteService.createResidentInvite).not.toHaveBeenCalled()
  })

  it("marks admission pending_finance when invoice generation fails", async () => {
    const harness = createServiceHarness()
    const draftResident = residentFixture({ status: "pending_finance" })
    const feeRecord = monthlyFeeRecordFixture()
    const pendingPayment = paymentFixture({
      monthly_fee_record_id: feeRecord.id,
      status: "pending",
      invoice_id: null,
    })
    const verifiedPayment = paymentFixture({
      ...pendingPayment,
      status: "verified",
      invoice_id: null,
    })

    harness.residentsRepository.create.mockResolvedValue(draftResident)
    harness.residentsRepository.getById.mockResolvedValue(draftResident)
    harness.paymentsRepository.createFeeRecord.mockResolvedValue(feeRecord)
    harness.paymentsRepository.create.mockResolvedValue(pendingPayment)
    harness.paymentsRepository.verify.mockResolvedValue(verifiedPayment)
    harness.invoicesService.generateVerifiedMonthlyFeePaymentInvoice.mockRejectedValue(
      new Error("invoice failed")
    )

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Invoice Pending Resident",
        phone: "+91 90000 01017",
        residentType: "student",
        monthlyFeeAmount: HOSTEL_FEES.student,
        firstMonthFeeStatus: "paid",
        firstMonthFeeAmount: HOSTEL_FEES.student,
      })
    ).rejects.toThrow("invoice failed")

    expect(harness.residentsRepository.update).toHaveBeenCalledWith(
      draftResident.id,
      TEST_ORGANIZATION_ID,
      expect.objectContaining({
        status: "pending_finance",
        metadata: expect.objectContaining({
          admission_finance_error: "invoice failed",
        }),
      })
    )
    expect(harness.residentInviteService.createResidentInvite).not.toHaveBeenCalled()
  })

  it("returns operational duplicate guidance before insert", async () => {
    const harness = createServiceHarness()
    const existingResident = residentFixture({
      status: "draft",
      admission_number: "SBH-DRAFT-009",
      phone: "+91 90000 01013",
      user_id: null,
    })

    harness.residentsRepository.findAdmissionDuplicate.mockResolvedValue({
      resident: existingResident,
      matchedFields: ["phone"],
    })

    await expect(
      harness.service.createResident({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fullName: "Duplicate Resident",
        phone: "+91 90000 01013",
        residentType: "student",
        monthlyFeeAmount: 6500,
        securityDepositAmount: 0,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: expect.objectContaining({
        type: "resident_duplicate",
        resident: expect.objectContaining({
          id: existingResident.id,
          admissionNumber: "SBH-DRAFT-009",
        }),
      }),
    })

    expect(harness.residentsRepository.create).not.toHaveBeenCalled()
  })

  it("checks out residents through the atomic repository function", async () => {
    const harness = createServiceHarness()
    const checkedOutResident = residentFixture({
      status: "checked_out",
      is_active: false,
      checkout_on: "2026-06-30",
    })

    harness.residentsRepository.checkout.mockResolvedValue(checkedOutResident)
    harness.residentsRepository.getById.mockResolvedValue(checkedOutResident)

    await expect(
      harness.service.checkoutResident({
        residentId: checkedOutResident.id,
        organizationId: TEST_ORGANIZATION_ID,
        checkoutDate: "2026-06-30",
        reason: "Resident completed stay.",
      })
    ).resolves.toEqual(checkedOutResident)

    expect(harness.residentsRepository.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: checkedOutResident.id,
        organizationId: TEST_ORGANIZATION_ID,
        checkoutDate: "2026-06-30",
        actorUserId: adminAuthContext().authUser.id,
      })
    )
  })

  it("repairs a resident lifecycle through the tenant-scoped repair RPC", async () => {
    const harness = createServiceHarness()
    const resident = {
      ...residentFixture({
      status: "draft",
      user_id: null,
      }),
      onboarding_status: "invited",
    }

    harness.residentsRepository.getById.mockResolvedValue(resident)

    await expect(
      harness.service.repairResidentLifecycle({
        residentId: resident.id,
        organizationId: TEST_ORGANIZATION_ID,
        dryRun: false,
      })
    ).resolves.toMatchObject({
      residentId: RESIDENT_ID,
      repairs: expect.objectContaining({
        authLinkRepaired: 1,
        duplicateInvitesRevoked: 1,
      }),
    })

    expect(harness.authService.requirePermission).toHaveBeenCalledWith("settings.manage")
    expect(harness.authService.requireHostelAccess).toHaveBeenCalledWith(
      expect.anything(),
      TEST_ORGANIZATION_ID,
      TEST_HOSTEL_ID
    )
    expect(harness.operationsRepository.repairResidentLifecycle).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      residentId: resident.id,
      actorUserId: adminAuthContext().authUser.id,
      dryRun: false,
    })
  })

  it("blocks mutating resident lifecycle repair in production before auth or RPC calls", async () => {
    vi.stubEnv("LAUNCH_MODE", "production")
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "production")

    const harness = createServiceHarness()
    const resident = {
      ...residentFixture({
        status: "draft",
        user_id: null,
      }),
      onboarding_status: "invited",
    }

    harness.residentsRepository.getById.mockResolvedValue(resident)

    await expect(
      harness.service.repairResidentLifecycle({
        residentId: resident.id,
        organizationId: TEST_ORGANIZATION_ID,
        dryRun: false,
      })
    ).rejects.toThrow(/resident lifecycle repair is blocked in production/i)

    expect(harness.authService.requirePermission).not.toHaveBeenCalled()
    expect(harness.operationsRepository.repairResidentLifecycle).not.toHaveBeenCalled()
  })
})
