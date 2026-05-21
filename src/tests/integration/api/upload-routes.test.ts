import { afterEach, describe, expect, it, vi } from "vitest"

import {
  PAYMENT_ID,
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import {
  createGetRequest,
  createMultipartRequest,
  readApiResponse,
  routeContext,
} from "@/tests/helpers"

describe("upload API routes", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/services/uploads.service")
  })

  it("uploads payment proof through UploadsService", async () => {
    const uploadPaymentProof = vi.fn().mockResolvedValue({
      document: {
        id: "document-id",
      },
      signedUrl: {
        signedUrl: "https://storage.test/signed-url",
      },
    })

    vi.doMock("@/services/uploads.service", () => ({
      UploadsService: {
        create: vi.fn().mockResolvedValue({ uploadPaymentProof }),
      },
    }))

    const { POST } = await import("@/app/api/uploads/payment-proof/route")
    const file = new File(["proof"], "proof.png", { type: "image/png" })
    const response = await POST(
      createMultipartRequest(
        "/api/uploads/payment-proof",
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          residentId: RESIDENT_ID,
          paymentId: PAYMENT_ID,
        },
        file
      )
    )
    const body = await readApiResponse<{ document: { id: string } }>(response)

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(uploadPaymentProof).toHaveBeenCalledWith(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          residentId: RESIDENT_ID,
          paymentId: PAYMENT_ID,
        },
        file
      )
    })

  it("creates signed preview URLs for payment proof", async () => {
    const getPaymentProofSignedUrl = vi.fn().mockResolvedValue({
      document: {
        id: "document-id",
      },
      paymentId: PAYMENT_ID,
      signedUrl: "https://storage.test/signed-proof",
      expiresInSeconds: 900,
    })

    vi.doMock("@/services/uploads.service", () => ({
      UploadsService: {
        create: vi.fn().mockResolvedValue({ getPaymentProofSignedUrl }),
      },
    }))

    const { GET } = await import("@/app/api/uploads/payment-proof/[paymentId]/route")
    const response = await GET(
      createGetRequest(`/api/uploads/payment-proof/${PAYMENT_ID}`, {
        organizationId: TEST_ORGANIZATION_ID,
      }),
      routeContext({ paymentId: PAYMENT_ID })
    )

    expect(response.status).toBe(200)
    expect(getPaymentProofSignedUrl).toHaveBeenCalledWith({
      organizationId: TEST_ORGANIZATION_ID,
      paymentId: PAYMENT_ID,
    })
  })
})
