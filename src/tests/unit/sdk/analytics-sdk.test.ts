import { afterEach, describe, expect, it, vi } from "vitest"

import { analyticsSdk } from "@/sdk/analytics.sdk"
import { TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("analyticsSdk owner exports", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ["csv", "text/csv", "owner-may.csv"],
    ["pdf", "application/pdf", "owner-may.pdf"],
  ] as const)(
    "downloads %s with same-origin cookie authentication",
    async (format, contentType, fileName) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(new Blob(["report"], { type: contentType }), {
          headers: {
            "content-type": contentType,
            "content-disposition": `attachment; filename="${fileName}"`,
          },
        })
      )
      vi.stubGlobal("fetch", fetchMock)

      const result = await analyticsSdk.downloadOwner({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fromDate: "2026-05-01",
        toDate: "2026-05-31",
        format,
      })

      expect(result.fileName).toBe(fileName)
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      const headers = new Headers(init.headers)

      expect(url).toContain("fromDate=2026-05-01")
      expect(url).toContain("toDate=2026-05-31")
      expect(url).toContain(`format=${format}`)
      expect(init.credentials).toBe("include")
      expect(headers.has("authorization")).toBe(false)
    }
  )
})
