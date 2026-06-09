import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("analytics performance configuration", () => {
  it("keeps dashboard analytics from recomputing on every mount or tab focus", () => {
    const hookSource = readFileSync(
      join(root, "src/hooks/use-analytics.ts"),
      "utf8"
    )
    const serviceSource = readFileSync(
      join(root, "src/services/analytics.service.ts"),
      "utf8"
    )

    expect(serviceSource).toContain("const DASHBOARD_CACHE_TTL_MS = 30_000")
    expect(hookSource).toContain("const DASHBOARD_ANALYTICS_STALE_TIME_MS = 30_000")
    expect(hookSource).toContain("const OWNER_ANALYTICS_STALE_TIME_MS = 30_000")
    expect(hookSource).toContain("refetchOnWindowFocus: false")
    expect(hookSource).not.toContain('refetchOnMount: "always"')
    expect(hookSource).not.toContain('refetchOnWindowFocus: "always"')
  })
})
