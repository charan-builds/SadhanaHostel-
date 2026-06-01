import { describe, expect, it, vi } from "vitest"

import { UploadsService } from "@/services/uploads.service"
import {
  PAYMENT_ID,
  RESIDENT_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
} from "@/tests/fixtures"

describe("upload access restrictions", () => {
  it("rejects unsupported document mime types before storage upload", async () => {
    const service = new UploadsService({} as never)
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue({
        roles: ["admin"],
        authUser: { id: "admin-id" },
      }),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getById: vi.fn().mockResolvedValue({
        id: RESIDENT_ID,
        user_id: "resident-user-id",
        hostel_id: "hostel-id",
      }),
    }
    const uploadsRepository = {
      uploadObject: vi.fn(),
      createDocument: vi.fn(),
      createSignedUrl: vi.fn(),
      removeObject: vi.fn(),
    }

    Object.assign(service, {
      authService,
      residentsRepository,
      uploadsRepository,
    })

    await expect(
      service.uploadDocument(
        {
          organizationId: TEST_ORGANIZATION_ID,
          residentId: RESIDENT_ID,
          documentType: "aadhaar",
        },
        new File(["bad"], "bad.exe", { type: "application/x-msdownload" })
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })

    expect(uploadsRepository.uploadObject).not.toHaveBeenCalled()
  })

  it("stores payment proof before resident profile completion", async () => {
    const service = new UploadsService({} as never)
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue({
        roles: ["resident"],
        authUser: { id: "resident-user-id" },
      }),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getById: vi.fn().mockResolvedValue({
        id: RESIDENT_ID,
        user_id: "resident-user-id",
        hostel_id: TEST_HOSTEL_ID,
        status: "active",
        onboarding_status: "profile_incomplete",
      }),
    }
    const paymentsRepository = {
      getById: vi.fn().mockResolvedValue({
        id: PAYMENT_ID,
        organization_id: TEST_ORGANIZATION_ID,
        hostel_id: TEST_HOSTEL_ID,
        resident_id: RESIDENT_ID,
        status: "pending",
      }),
    }
    const uploadsRepository = {
      uploadObject: vi.fn().mockResolvedValue({ path: "uploaded" }),
      createDocument: vi.fn().mockImplementation((values) =>
        Promise.resolve({
          id: "document-id",
          ...values,
        })
      ),
      createSignedUrl: vi.fn().mockResolvedValue("https://storage.test/signed"),
      removeObject: vi.fn(),
    }
    const file = new File(["payment-proof"], "Proof Screenshot.PNG", {
      type: "image/png",
    })

    Object.assign(service, {
      authService,
      residentsRepository,
      paymentsRepository,
      uploadsRepository,
    })

    await expect(
      service.uploadPaymentProof(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          residentId: RESIDENT_ID,
          paymentId: PAYMENT_ID,
        },
        file
      )
    ).resolves.toMatchObject({
      signedUrl: "https://storage.test/signed",
    })

    const documentPayload = uploadsRepository.createDocument.mock.calls[0][0]

    expect(documentPayload.storage_path).toMatch(
      new RegExp(`^${TEST_ORGANIZATION_ID}/${RESIDENT_ID}/${PAYMENT_ID}/`)
    )
    expect(documentPayload.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(documentPayload.document_type).toBe("payment_receipt")
  })

  it("rejects uploads when the requested hostel scope does not match the resident", async () => {
    const service = new UploadsService({} as never)
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue({
        roles: ["admin"],
        authUser: { id: "admin-id" },
      }),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getById: vi.fn().mockResolvedValue({
        id: RESIDENT_ID,
        user_id: "resident-user-id",
        hostel_id: TEST_HOSTEL_ID,
        status: "active",
        onboarding_status: "verified",
      }),
    }
    const uploadsRepository = {
      uploadObject: vi.fn(),
      createDocument: vi.fn(),
      createSignedUrl: vi.fn(),
      removeObject: vi.fn(),
    }
    const file = new File(["aadhaar"], "aadhaar.pdf", {
      type: "application/pdf",
    })

    Object.assign(service, {
      authService,
      residentsRepository,
      uploadsRepository,
    })

    await expect(
      service.uploadDocument(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: "00000000-0000-4000-8000-000000000099",
          residentId: RESIDENT_ID,
          documentType: "aadhaar",
        },
        file
      )
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    })

    expect(uploadsRepository.uploadObject).not.toHaveBeenCalled()
  })
})
