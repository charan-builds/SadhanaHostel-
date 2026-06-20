import { describe, expect, it } from "vitest"

import {
  billingDayFromJoinedOn,
  buildBillingDateForMonth,
  buildResidentBillingContext,
  resolveNextBillingDueDate,
  resolveNextPaymentDate,
} from "@/lib/finance/billing-date"

describe("finance billing date utility", () => {
  it("uses the resident join day for anniversary billing", () => {
    const billing = buildResidentBillingContext({
      joinedOn: "2026-01-10",
      today: "2026-06-05",
    })

    expect(billing.billingDay).toBe(10)
    expect(billing.currentDueDate).toBe("2026-06-10")
    expect(resolveNextBillingDueDate({ billing, today: "2026-06-05" })).toBe("2026-06-10")
  })

  it("clamps Jan 31 billing to February month end", () => {
    expect(billingDayFromJoinedOn("2026-01-31")).toBe(31)
    expect(buildBillingDateForMonth("2026-02-01", 31)).toBe("2026-02-28")
  })

  it("is leap-year safe for February", () => {
    expect(buildBillingDateForMonth("2024-02-01", 31)).toBe("2024-02-29")
  })

  it("clamps every short month to month end", () => {
    expect(buildBillingDateForMonth("2026-04-01", 31)).toBe("2026-04-30")
    expect(buildBillingDateForMonth("2026-06-01", 31)).toBe("2026-06-30")
  })

  it("rolls next due date to the next month after this month due date has passed", () => {
    const billing = buildResidentBillingContext({
      joinedOn: "2026-01-31",
      today: "2026-02-28",
    })

    expect(resolveNextBillingDueDate({ billing, today: "2026-03-01" })).toBe("2026-03-31")
  })
})

describe("resolveNextPaymentDate", () => {
  it("moves to the month after the latest cleared fee using the joining day", () => {
    expect(
      resolveNextPaymentDate({
        joinedOn: "2026-05-10",
        today: "2026-06-20",
        feeRecords: [
          {
            period_month: "2026-06-01",
            due_date: "2026-06-10",
            balance_amount: 0,
            status: "paid",
          },
          {
            period_month: "2026-07-01",
            due_date: "2026-07-10",
            balance_amount: 0,
            status: "paid",
          },
        ],
      })
    ).toBe("2026-08-10")
  })
})
