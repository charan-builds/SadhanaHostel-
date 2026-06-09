import { describe, expect, it, vi } from "vitest"

import { WebsiteService } from "@/services/website.service"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import { adminAuthContext } from "@/tests/helpers"

const VALID_PNG_BYTES = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
])

function createWebsiteServiceHarness() {
  const service = new WebsiteService({} as never)
  const authService = {
    requirePermission: vi.fn().mockResolvedValue(adminAuthContext()),
    resolveHostelScope: vi.fn((_context, _organizationId, hostelId?: string) => hostelId),
  }
  const uploadsRepository = {
    uploadObject: vi.fn().mockResolvedValue({ path: "uploaded" }),
    createDocument: vi.fn().mockImplementation((values) =>
      Promise.resolve({
        id: "document-id",
        ...values,
      })
    ),
    getPublicUrl: vi.fn().mockReturnValue("https://storage.test/gallery.png"),
    removeObject: vi.fn(),
  }
  const websiteRepository = {
    createGalleryItem: vi.fn().mockImplementation((values) =>
      Promise.resolve({
        id: "gallery-id",
        created_at: "2026-06-09T00:00:00.000Z",
        updated_at: "2026-06-09T00:00:00.000Z",
        ...values,
      })
    ),
  }

  Object.assign(service, {
    authService,
    uploadsRepository,
    websiteRepository,
  })

  return {
    service,
    uploadsRepository,
    websiteRepository,
  }
}

describe("WebsiteService uploads", () => {
  it("stores gallery uploads with content validation and sanitized file metadata", async () => {
    const harness = createWebsiteServiceHarness()
    const file = new File([VALID_PNG_BYTES], "../../Hero Banner.php.png", {
      type: "image/png",
    })

    await expect(
      harness.service.uploadGalleryImage(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          title: "Hero Banner",
          altText: "Hostel hero banner",
          category: "hero",
          status: "published",
        },
        file
      )
    ).resolves.toMatchObject({
      document: {
        file_name: "hero-banner-php.png",
        mime_type: "image/png",
      },
    })

    expect(harness.uploadsRepository.uploadObject).toHaveBeenCalledWith(
      "gallery-images",
      expect.stringMatching(
        new RegExp(
          `^${TEST_ORGANIZATION_ID}/${TEST_HOSTEL_ID}/gallery/[a-f0-9-]+-hero-banner-php\\.png$`
        )
      ),
      file,
      {
        cacheControl: "31536000",
        upsert: false,
      }
    )
    expect(harness.websiteRepository.createGalleryItem).toHaveBeenCalled()
  })

  it("rejects gallery images whose body does not match the declared MIME type", async () => {
    const harness = createWebsiteServiceHarness()
    const file = new File(["<svg onload=alert(1)>"], "gallery.png", {
      type: "image/png",
    })

    await expect(
      harness.service.uploadGalleryImage(
        {
          organizationId: TEST_ORGANIZATION_ID,
          hostelId: TEST_HOSTEL_ID,
          title: "Gallery",
          altText: "Gallery image",
        },
        file
      )
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })

    expect(harness.uploadsRepository.uploadObject).not.toHaveBeenCalled()
    expect(harness.websiteRepository.createGalleryItem).not.toHaveBeenCalled()
  })
})
