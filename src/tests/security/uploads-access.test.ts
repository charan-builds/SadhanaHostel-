import { describe, expect, it, vi } from "vitest"

import { UploadsService } from "@/services/uploads.service"
import { RESIDENT_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

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
})
