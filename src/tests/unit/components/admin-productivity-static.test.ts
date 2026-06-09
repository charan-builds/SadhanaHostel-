import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("admin productivity topbar actions", () => {
  it("keeps common admin workflows reachable from the topbar", () => {
    const source = readFileSync(
      join(root, "src/components/admin/layout/admin-topbar.tsx"),
      "utf8"
    )

    expect(source).toContain("AdminProductivityMenu")
    expect(source).toContain("Open admin productivity actions")
    expect(source).toContain("adminQuickActions")
    expect(source).toContain("Open operations")
    expect(source).toContain("Follow up dues")
    expect(source).toContain("/admin/finance/followups")
  })
})
