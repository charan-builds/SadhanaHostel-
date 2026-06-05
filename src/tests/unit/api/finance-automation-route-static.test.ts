import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const route = readFileSync("src/app/api/finance/automation/run/route.ts", "utf8")

describe("Finance automation route protection", () => {
  it("uses the finance-safe automation entrypoint", () => {
    expect(route).toMatch(/runFinanceSafe/)
    expect(route).toMatch(/financeAutomationRunSchema/)
    expect(route).not.toMatch(/\.run\(values\)/)
  })
})
