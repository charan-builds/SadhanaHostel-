import { describe, expect, it } from "vitest"

import { normalizeDateRange } from "@/lib/date-range"

describe("normalizeDateRange", () => {
  it("normalizes same-day exports to full UTC day boundaries", () => {
    expect(
      normalizeDateRange({
        fromDate: "2026-06-05",
        toDate: "2026-06-05",
      })
    ).toEqual({
      fromDate: "2026-06-05T00:00:00.000Z",
      toDate: "2026-06-05T23:59:59.999Z",
    })
  })

  it("normalizes multi-day exports inclusively", () => {
    expect(
      normalizeDateRange({
        fromDate: "2026-06-01",
        toDate: "2026-06-30",
      })
    ).toEqual({
      fromDate: "2026-06-01T00:00:00.000Z",
      toDate: "2026-06-30T23:59:59.999Z",
    })
  })

  it("handles timezone-offset timestamp inputs by normalizing the UTC day", () => {
    expect(
      normalizeDateRange({
        fromDate: "2026-06-05T23:30:00+05:30",
        toDate: "2026-06-05T23:30:00+05:30",
      })
    ).toEqual({
      fromDate: "2026-06-05T00:00:00.000Z",
      toDate: "2026-06-05T23:59:59.999Z",
    })
  })
})
