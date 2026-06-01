import { afterEach, describe, expect, it, vi } from "vitest"

import {
  PAYMENT_ID,
  paymentFixture,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import {
  createJsonRequest,
  createMultipartRequest,
  readApiResponse,
  routeContext,
} from "@/tests/helpers"

describe("payment API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/payments.service")
  })

  it("creates UPI payment records through PaymentsService", async () => {
    const payment = paymentFixture()
    const createUpiPayment = vi.fn().mockResolvedValue(payment)

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ createUpiPayment }),
      },
    }))

    const { POST } = await import("@/app/api/payments/create/route")
    const response = await POST(
      createJsonRequest("/api/payments/create", {
        organizationId: TEST_ORGANIZATION_ID,
        amount: 6500,
      })
    )
    const body = await readApiResponse<typeof payment>(response)

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(createUpiPayment).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      amount: 6500,
    })
  })

  it("records in-person payments through PaymentsService", async () => {
    const payment = paymentFixture({ method: "cash", status: "verified" })
    const recordInPersonPayment = vi.fn().mockResolvedValue(payment)

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ recordInPersonPayment }),
      },
    }))

    const { POST } = await import("@/app/api/payments/record-in-person/route")
    const response = await POST(
      createJsonRequest("/api/payments/record-in-person", {
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        amount: 3500,
        method: "cash",
      })
    )
    const body = await readApiResponse<typeof payment>(response)

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(recordInPersonPayment).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      amount: 3500,
      method: "cash",
    })
  })

  it("routes payment verification through PaymentsService", async () => {
    const payment = paymentFixture({ status: "verified" })
    const verifyPayment = vi.fn().mockResolvedValue(payment)

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ verifyPayment }),
      },
    }))

    const { POST } = await import("@/app/api/payments/verify/route")
    const response = await POST(
      createJsonRequest("/api/payments/verify", {
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    )
    const body = await readApiResponse<typeof payment>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(verifyPayment).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      paymentId: PAYMENT_ID,
    })
  })

  it("routes payment rejection through PaymentsService", async () => {
    const payment = paymentFixture({ status: "failed" })
    const rejectPayment = vi.fn().mockResolvedValue(payment)

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ rejectPayment }),
      },
    }))

    const { POST } = await import("@/app/api/payments/reject/route")
    const response = await POST(
      createJsonRequest("/api/payments/reject", {
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
        reason: "UTR does not match the screenshot.",
      })
    )
    const body = await readApiResponse<typeof payment>(response)

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(rejectPayment).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      paymentId: PAYMENT_ID,
      reason: "UTR does not match the screenshot.",
    })
  })

  it("loads active manual payment settings through PaymentsService", async () => {
    const getActivePaymentSettings = vi.fn().mockResolvedValue({
      id: "payment-setting-id",
      organization_id: TEST_ORGANIZATION_ID,
    })

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ getActivePaymentSettings }),
      },
    }))

    const { GET } = await import("@/app/api/payments/settings/route")
    const response = await GET(
      new Request(
        `http://localhost/api/payments/settings?organizationId=${TEST_ORGANIZATION_ID}&hostelId=${TEST_HOSTEL_ID}`
      )
    )

    expect(response.status).toBe(200)
    expect(getActivePaymentSettings).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })
  })

  it("saves manual payment settings through PaymentsService", async () => {
    const savePaymentSettings = vi.fn().mockResolvedValue({
      id: "payment-setting-id",
      organization_id: TEST_ORGANIZATION_ID,
    })

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ savePaymentSettings }),
      },
    }))

    const { PATCH } = await import("@/app/api/payments/settings/route")
    const payload = {
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      paymentMethod: "upi",
      accountName: "Sadhana Boys Hostel",
      upiId: "sadhana@upi",
      isActive: true,
      supportsManualVerification: true,
    }
    const response = await PATCH(createJsonRequest("/api/payments/settings", payload))

    expect(response.status).toBe(200)
    expect(savePaymentSettings).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        requestId: expect.any(String),
      })
    )
  })

  it("loads payment settings history through PaymentsService", async () => {
    const listPaymentSettings = vi.fn().mockResolvedValue([])

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ listPaymentSettings }),
      },
    }))

    const { GET } = await import("@/app/api/payments/settings/history/route")
    const response = await GET(
      new Request(
        `http://localhost/api/payments/settings/history?organizationId=${TEST_ORGANIZATION_ID}&hostelId=${TEST_HOSTEL_ID}`
      )
    )

    expect(response.status).toBe(200)
    expect(listPaymentSettings).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })
  })

  it("tests payment settings through PaymentsService", async () => {
    const testPaymentSettings = vi.fn().mockResolvedValue({
      status: "pass",
      checks: [],
    })

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ testPaymentSettings }),
      },
    }))

    const { POST } = await import("@/app/api/payments/settings/test/route")
    const payload = {
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
    }
    const response = await POST(createJsonRequest("/api/payments/settings/test", payload))

    expect(response.status).toBe(200)
    expect(testPaymentSettings).toHaveBeenCalledWith(payload)
  })

  it("uploads payment QR images through PaymentsService", async () => {
    const uploadPaymentQr = vi.fn().mockResolvedValue({
      storagePath: `${TEST_ORGANIZATION_ID}/payment-settings/qr/${TEST_HOSTEL_ID}/current.png`,
    })

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ uploadPaymentQr }),
      },
    }))

    const { POST } = await import("@/app/api/payments/settings/qr/route")
    const file = new File(["qr"], "qr.png", { type: "image/png" })
    const response = await POST(
      createMultipartRequest(
        "/api/payments/settings/qr",
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
        },
        file
      )
    )

    expect(response.status).toBe(201)
    expect(uploadPaymentQr).toHaveBeenCalledWith(
      {
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      },
      file,
      expect.objectContaining({
        requestId: expect.any(String),
      })
    )
  })

  it("loads resident ledger through PaymentsService", async () => {
    const getResidentLedger = vi.fn().mockResolvedValue({
      totals: {
        currentDue: 6500,
      },
    })

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ getResidentLedger }),
      },
    }))

    const { GET } = await import("@/app/api/payments/ledger/route")
    const response = await GET(
      new Request(
        `http://localhost/api/payments/ledger?organizationId=${TEST_ORGANIZATION_ID}`
      )
    )

    expect(response.status).toBe(200)
    expect(getResidentLedger).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
    })
  })

  it("loads a payment by id through PaymentsService", async () => {
    const payment = paymentFixture()
    const getPayment = vi.fn().mockResolvedValue(payment)

    vi.doMock("@/services/payments.service", () => ({
      PaymentsService: {
        create: vi.fn().mockResolvedValue({ getPayment }),
      },
    }))

    const { GET } = await import("@/app/api/payments/[id]/route")
    const response = await GET(
      new Request(
        `http://localhost/api/payments/${PAYMENT_ID}?organizationId=${TEST_ORGANIZATION_ID}`
      ),
      routeContext({ id: PAYMENT_ID })
    )

    expect(response.status).toBe(200)
    expect(getPayment).toHaveBeenCalledWith(PAYMENT_ID, TEST_ORGANIZATION_ID)
  })
})
