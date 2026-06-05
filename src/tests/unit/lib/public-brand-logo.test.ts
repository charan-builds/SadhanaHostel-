import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getPublishedBrandIconUrl,
  getPublishedBrandLogoUrl,
} from "@/lib/public-brand-logo"

const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID: process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID,
  NEXT_PUBLIC_DEFAULT_HOSTEL_ID: process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID,
}

describe("public brand logo", () => {
  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_SUPABASE_URL", originalEnv.NEXT_PUBLIC_SUPABASE_URL)
    restoreEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", originalEnv.SUPABASE_SERVICE_ROLE_KEY)
    restoreEnv(
      "NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID",
      originalEnv.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
    )
    restoreEnv("NEXT_PUBLIC_DEFAULT_HOSTEL_ID", originalEnv.NEXT_PUBLIC_DEFAULT_HOSTEL_ID)
    vi.unstubAllGlobals()
  })

  it("returns null when public tenant configuration is incomplete", async () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID
    const fetchMock = vi.fn()

    vi.stubGlobal("fetch", fetchMock)

    await expect(getPublishedBrandLogoUrl()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses the organization settings logo before gallery fallback", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co/"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID = "org-1"
    process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID = "hostel-1"

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          settings: {
            branding: {
              logoUrl: " https://cdn.example.com/sadhana-logo.png ",
            },
          },
        },
      ])
    )

    vi.stubGlobal("fetch", fetchMock)

    await expect(getPublishedBrandLogoUrl()).resolves.toBe(
      "https://cdn.example.com/sadhana-logo.png"
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/rest/v1/organizations?")
  })

  it("uses the organization settings favicon for generated app icons", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co/"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID = "org-1"
    process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID = "hostel-1"

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          settings: {
            branding: {
              logoUrl: "https://cdn.example.com/sadhana-logo.png",
              faviconUrl: "https://cdn.example.com/sadhana-tab-icon.png",
            },
          },
        },
      ])
    )

    vi.stubGlobal("fetch", fetchMock)

    await expect(getPublishedBrandIconUrl()).resolves.toBe(
      "https://cdn.example.com/sadhana-tab-icon.png"
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("resolves the published gallery logo to a versioned public storage URL when settings are empty", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co/"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID = "org-1"
    process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID = "hostel-1"

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            settings: {
              branding: {},
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            title: "Sadhana Boys Hostel logo",
            category: "logo",
            document_id: "document-1",
            updated_at: "2026-06-05T00:00:00.000Z",
            created_at: "2026-06-04T00:00:00.000Z",
          },
        ])
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            bucket_name: "gallery-images",
            storage_path: "org-1/hostel-1/gallery/sadhana logo.png",
          },
        ])
      )

    vi.stubGlobal("fetch", fetchMock)

    await expect(getPublishedBrandLogoUrl()).resolves.toBe(
      "https://test-project.supabase.co/storage/v1/object/public/gallery-images/org-1/hostel-1/gallery/sadhana%20logo.png?v=2026-06-05T00%3A00%3A00.000Z"
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("or=%28hostel_id.is.null")
  })
})

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  }
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
