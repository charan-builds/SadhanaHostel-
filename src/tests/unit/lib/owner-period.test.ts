import { describe, expect, it } from "vitest"

import {
  formatOwnerPeriodLabel,
  getOwnerPeriodRange,
  getPreviousOwnerPeriod,
} from "@/lib/analytics/owner-period"

describe("owner analytics periods", () => {
  const now = new Date("2026-06-09T12:00:00.000Z")

  it("builds month presets from UTC calendar boundaries", () => {
    expect(getOwnerPeriodRange("this_month", now)).toEqual({
      fromDate: "2026-06-01",
      toDate: "2026-06-09",
    })
    expect(getOwnerPeriodRange("last_month", now)).toEqual({
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
    })
  })

  it("compares a partial current month with the same elapsed prior month", () => {
    expect(
      getPreviousOwnerPeriod(
        { fromDate: "2026-06-01", toDate: "2026-06-09" },
        "this_month"
      )
    ).toEqual({
      fromDate: "2026-05-01",
      toDate: "2026-05-09",
    })
  })

  it("labels the active month clearly", () => {
    expect(
      formatOwnerPeriodLabel(
        { fromDate: "2026-06-01", toDate: "2026-06-09" },
        "this_month"
      )
    ).toBe("June 2026")
  })
})
