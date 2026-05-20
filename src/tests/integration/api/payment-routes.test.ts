import { afterEach, describe, expect, it, vi } from "vitest"

import { PAYMENT_ID, paymentFixture, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { createJsonRequest, readApiResponse, routeContext } from "@/tests/helpers"

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
