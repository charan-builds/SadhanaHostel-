import { describe, expect, it } from "vitest"

import { buildFeeDueStatus } from "@/components/resident/resident-dashboard-client"

const today = new Date("2026-06-06T12:00:00.000Z")

describe("resident fee due status banner", () => {
  it("classifies future, urgent, tomorrow, and overdue fee states", () => {
    expect(
      buildFeeDueStatus({
        amountDue: 6500,
        dueDate: "2026-06-13",
        today,
      })
    ).toEqual(
      expect.objectContaining({
        label: "Due in 7 days",
        className: expect.stringContaining("emerald"),
      })
    )

    expect(
      buildFeeDueStatus({
        amountDue: 6500,
        dueDate: "2026-06-09",
        today,
      })
    ).toEqual(
      expect.objectContaining({
        label: "Due in 3 days",
        className: expect.stringContaining("yellow"),
      })
    )

    expect(
      buildFeeDueStatus({
        amountDue: 6500,
        dueDate: "2026-06-07",
        today,
      })
    ).toEqual(
      expect.objectContaining({
        label: "Due tomorrow",
        className: expect.stringContaining("orange"),
      })
    )

    expect(
      buildFeeDueStatus({
        amountDue: 6500,
        dueDate: "2026-06-04",
        today,
      })
    ).toEqual(
      expect.objectContaining({
        label: "Overdue by 2 days",
        className: expect.stringContaining("red"),
      })
    )
  })
})
