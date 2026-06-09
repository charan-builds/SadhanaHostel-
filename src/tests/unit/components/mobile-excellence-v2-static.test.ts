import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("mobile excellence v2 surfaces", () => {
  it("keeps resident leave history card-first on mobile and table-first on desktop", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-leave-client.tsx"),
      "utf8"
    )

    expect(source).toContain("ResidentLeaveHistoryCard")
    expect(source).toContain("lg:hidden")
    expect(source).toContain("hidden overflow-x-auto lg:block")
    expect(source).toContain("Waiting for review")
    expect(source).toContain("ResidentLeaveInfo")
  })

  it("keeps collections actions mobile-first without flooding the row", () => {
    const source = readFileSync(
      join(root, "src/components/admin/finance/admin-collections-client.tsx"),
      "utf8"
    )

    expect(source).toContain("Open Ledger")
    expect(source).toContain("More actions")
    expect(source).toContain("lg:hidden")
    expect(source).toContain("hidden flex-wrap gap-2 lg:flex")
    expect(source).toContain("More actions")
  })
})
