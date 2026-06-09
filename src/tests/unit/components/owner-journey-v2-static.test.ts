import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("owner journey v2 dashboard hierarchy", () => {
  it("promotes the first owner action as the top owner action", () => {
    const source = readFileSync(
      join(root, "src/components/admin/analytics/owner-dashboard-client.tsx"),
      "utf8"
    )

    expect(source).toContain("type OwnerAction")
    expect(source).toContain("const primaryAction = actions[0]")
    expect(source).toContain("const secondaryActions = actions.slice(1)")
    expect(source).toContain("Top owner action")
    expect(source).toContain("OwnerActionCard")
    expect(source).toContain('emphasis?: "default" | "primary"')
  })

  it("shows a daily owner digest before detailed dashboard sections", () => {
    const source = readFileSync(
      join(root, "src/components/admin/analytics/owner-dashboard-client.tsx"),
      "utf8"
    )

    expect(source).toContain("OwnerDailyDigest")
    expect(source).toContain("Daily Owner Digest")
    expect(source).toContain("What requires attention today")
    expect(source).toContain("money, occupancy, communication, and support")
    expect(source).toContain("pendingPaymentTotal")
    expect(source).toContain("noticeAcknowledgementPending")
    expect(source).toContain("residentReportTotal")
  })

  it("adds owner forecasting and risk-alert recommendations from existing analytics", () => {
    const source = readFileSync(
      join(root, "src/components/admin/analytics/owner-dashboard-client.tsx"),
      "utf8"
    )

    expect(source).toContain("OwnerForecastPanel")
    expect(source).toContain("Forecast and Risk Alerts")
    expect(source).toContain("data.forecasts.revenue")
    expect(source).toContain("Expected billing")
    expect(source).toContain("Expected collection")
    expect(source).toContain("Risk-adjusted dues")
    expect(source).toContain("Occupancy forecast")
    expect(source).toContain("Recommended owner actions")
  })
})
