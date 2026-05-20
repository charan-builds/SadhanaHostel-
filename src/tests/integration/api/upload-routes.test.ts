import { afterEach, describe, expect, it, vi } from "vitest"

import { RESIDENT_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { createMultipartRequest, readApiResponse } from "@/tests/helpers"

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
          residentId: RESIDENT_ID,
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
        residentId: RESIDENT_ID,
      },
      file
    )
  })
})
