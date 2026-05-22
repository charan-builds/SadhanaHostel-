import { describe, expect, it } from "vitest"

import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"
import {
  bootstrapAdminTenantSchema,
  hostelUpdateSchema,
  updateOrganizationSchema,
} from "@/validations/platform.validation"
import { uploadGalleryImageSchema } from "@/validations/website.validation"

describe("admin operational validation", () => {
  it("normalizes the initial setup wizard into a safe tenant bootstrap payload", () => {
    const result = bootstrapAdminTenantSchema.parse({
      organizationName: "Sadhana Boys Hostel",
      organizationPhone: "+919876543210",
      hostelCapacity: "70",
      upiId: "sadhanahostel@ibl",
      paymentAccountName: "Sadhana Boys Hostel",
    })

    expect(result.hostelCapacity).toBe(70)
    expect(result.upiId).toBe("sadhanahostel@ibl")
  })

  it("allows organization branding settings to be saved from the admin panel", () => {
    const result = updateOrganizationSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      name: "Sadhana Boys Hostel",
      settings: {
        timezone: "Asia/Kolkata",
        branding: {
          logoUrl: "https://example.com/logo.png",
          faviconUrl: "https://example.com/favicon.ico",
          primaryColor: "#0f766e",
        },
      },
    })

    expect(result.success).toBe(true)
  })

  it("requires at least one real hostel update field", () => {
    const result = hostelUpdateSchema.safeParse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(result.success).toBe(false)
  })

  it("validates gallery upload metadata for CMS-backed public images", () => {
    const result = uploadGalleryImageSchema.parse({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
      title: "Dining Hall",
      category: "food",
      sortOrder: "2",
      status: "published",
    })

    expect(result.sortOrder).toBe(2)
    expect(result.status).toBe("published")
  })
})
