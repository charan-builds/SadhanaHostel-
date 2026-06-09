import { describe, expect, it } from "vitest"

import {
  formatOwnerPeriodLabel,
  getOwnerPeriodRange,
  getPreviousOwnerPeriod,
} from "@/lib/analytics/owner-period"

describe("owner analytics periods", () => {
  const now = new Date("2026-06-09T12:00:00.000Z")

  it("builds core period presets from UTC calendar boundaries", () => {
    expect(getOwnerPeriodRange("day", now)).toEqual({
      fromDate: "2026-06-09",
      toDate: "2026-06-09",
    })
    expect(getOwnerPeriodRange("week", now)).toEqual({
      fromDate: "2026-06-08",
      toDate: "2026-06-09",
    })
    expect(getOwnerPeriodRange("month", now)).toEqual({
      fromDate: "2026-06-01",
      toDate: "2026-06-09",
    })
    expect(getOwnerPeriodRange("quarter", now)).toEqual({
      fromDate: "2026-04-01",
      toDate: "2026-06-09",
    })
    expect(getOwnerPeriodRange("year", now)).toEqual({
      fromDate: "2026-01-01",
      toDate: "2026-06-09",
    })
  })

  it("compares a partial current month with the same elapsed prior month", () => {
    expect(
      getPreviousOwnerPeriod(
        { fromDate: "2026-06-01", toDate: "2026-06-09" },
        "month"
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
        "month"
      )
    ).toBe("June 2026")
  })

  it("labels current quarter and year presets clearly", () => {
    expect(
      formatOwnerPeriodLabel(
        { fromDate: "2026-04-01", toDate: "2026-06-09" },
        "quarter"
      )
    ).toBe("Q2 2026")
    expect(
      formatOwnerPeriodLabel(
        { fromDate: "2026-01-01", toDate: "2026-06-09" },
        "year"
      )
    ).toBe("2026")
  })
})
