import { describe, expect, it } from "vitest"

import {
  buildMonthOptions,
  describeMonthwiseRange,
  exactMonthValue,
  getMonthwiseQuickFilterRange,
  monthwiseQuickFilterLabels,
} from "@/lib/monthwise-analytics"

describe("monthwise analytics date ranges", () => {
  const now = new Date("2026-03-15T12:00:00.000Z")

  it("builds explicit month selector options such as January, February, and March 2026", () => {
    const options = buildMonthOptions(now, 3)

    expect(options.map((option) => option.label)).toEqual([
      "March 2026",
      "February 2026",
      "January 2026",
    ])
    expect(options[0]).toMatchObject({
      value: "2026-03",
      fromDate: "2026-03-01",
      toDate: "2026-03-15",
    })
    expect(options[1]).toMatchObject({
      value: "2026-02",
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
    })
  })

  it("normalizes owner quick filters to real date ranges", () => {
    expect(getMonthwiseQuickFilterRange("this-month", now)).toEqual({
      fromDate: "2026-03-01",
      toDate: "2026-03-15",
    })
    expect(getMonthwiseQuickFilterRange("last-month", now)).toEqual({
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
    })
    expect(getMonthwiseQuickFilterRange("last-3-months", now)).toEqual({
      fromDate: "2026-01-01",
      toDate: "2026-03-15",
    })
    expect(getMonthwiseQuickFilterRange("last-6-months", now)).toEqual({
      fromDate: "2025-10-01",
      toDate: "2026-03-15",
    })
    expect(getMonthwiseQuickFilterRange("this-year", now)).toEqual({
      fromDate: "2026-01-01",
      toDate: "2026-03-15",
    })
  })

  it("labels exact months and preserves custom ranges", () => {
    expect(
      describeMonthwiseRange({
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
      })
    ).toBe("January 2026")
    expect(
      exactMonthValue({
        fromDate: "2026-01-10",
        toDate: "2026-02-02",
      })
    ).toBe("range")
  })

  it("keeps the requested quick filter labels available", () => {
    expect(Object.values(monthwiseQuickFilterLabels)).toEqual([
      "This Month",
      "Last Month",
      "Last 3 Months",
      "Last 6 Months",
      "This Year",
      "Custom Range",
    ])
  })
})
