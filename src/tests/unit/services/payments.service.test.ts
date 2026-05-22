import { describe, expect, it, vi } from "vitest"

import { PaymentsService } from "@/services/payments.service"
import {
  PAYMENT_ID,
  paymentFixture,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

function createServiceHarness() {
  const service = new PaymentsService({} as never)
  const authService = {
    requireRole: vi.fn().mockResolvedValue(adminAuthContext()),
    requireOrganizationAccess: vi.fn(),
  }
  const paymentsRepository = {
    getById: vi.fn(),
    verify: vi.fn(),
    reject: vi.fn(),
  }
  const uploadsRepository = {
    findLatestPaymentProof: vi.fn(),
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

  Object.assign(service, {
    authService,
    paymentsRepository,
    uploadsRepository,
    residentsRepository,
    realtimeService,
    notificationService,
  })

  return {
    service,
    paymentsRepository,
    uploadsRepository,
  }
}

describe("PaymentsService", () => {
  it("does not verify an already verified payment", async () => {
    const harness = createServiceHarness()

    harness.paymentsRepository.getById.mockResolvedValue(
      paymentFixture({ status: "verified" })
    )

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Payment is already verified.",
    })

    expect(harness.paymentsRepository.verify).not.toHaveBeenCalled()
  })

  it("delegates pending payment verification to the repository", async () => {
    const harness = createServiceHarness()
    const verified = paymentFixture({ status: "verified" })

    harness.paymentsRepository.getById.mockResolvedValue(paymentFixture())
    harness.uploadsRepository.findLatestPaymentProof.mockResolvedValue({
      resident_id: paymentFixture().resident_id,
    })
    harness.paymentsRepository.verify.mockResolvedValue(verified)

    await expect(
      harness.service.verifyPayment({
        organizationId: TEST_ORGANIZATION_ID,
        paymentId: PAYMENT_ID,
      })
    ).resolves.toEqual(verified)

    expect(harness.paymentsRepository.verify).toHaveBeenCalledWith(
      PAYMENT_ID,
      TEST_ORGANIZATION_ID,
      adminAuthContext().authUser.id,
      undefined
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
})
