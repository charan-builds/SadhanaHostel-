import { expect, test } from "@playwright/test"

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001"
const HOSTEL_ID = "00000000-0000-4000-8000-000000000002"
const RESIDENT_ID = "00000000-0000-4000-8000-000000000031"
const PAYMENT_ID = "00000000-0000-4000-8000-000000000051"

test.describe("black-box unauthenticated abuse resistance", () => {
  test("finance APIs reject anonymous access without leaking internals", async ({
    request,
  }) => {
    const routes = [
      request.get(
        `/api/payments/settings?organizationId=${ORGANIZATION_ID}&hostelId=${HOSTEL_ID}`
      ),
      request.get(`/api/payments/ledger?organizationId=${ORGANIZATION_ID}`),
      request.post("/api/payments/reject", {
        data: {
          organizationId: ORGANIZATION_ID,
          paymentId: PAYMENT_ID,
          reason: "invalid proof",
        },
      }),
      request.post("/api/payments/verify", {
        data: {
          organizationId: ORGANIZATION_ID,
          paymentId: PAYMENT_ID,
        },
      }),
    ]

    for (const response of await Promise.all(routes)) {
      const body = await response.json()

      expect([401, 403]).toContain(response.status())
      expect(body.success).toBe(false)
      expect(body.error.message).not.toMatch(/service_role|stack|postgres|supabase/i)
    }
  })

  test("payment proof preview blocks anonymous signed URL creation", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/uploads/payment-proof/${PAYMENT_ID}?organizationId=${ORGANIZATION_ID}`
    )
    const body = await response.json()

    expect([401, 403]).toContain(response.status())
    expect(body.success).toBe(false)
    expect(body.error.message).not.toMatch(/signedUrl|storage_path|bucket/i)
  })

  test("payment proof upload requires multipart file input", async ({ request }) => {
    const response = await request.post("/api/payments/submit-upi", {
      multipart: {
        organizationId: ORGANIZATION_ID,
        hostelId: HOSTEL_ID,
        residentId: RESIDENT_ID,
        amount: "6500",
        transactionId: "QAUPI123456",
        idempotencyKey: "qa-idempotency-key",
      },
    })
    const body = await response.json()

    expect(response.status()).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.message).toMatch(/file/i)
  })

  test("malformed JSON receives a safe standardized error", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: "{not-valid-json",
      headers: {
        "content-type": "application/json",
      },
    })
    const body = await response.json()

    expect(response.status()).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.message).toMatch(/JSON/i)
  })
})
