import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("resident journey v2 dashboard hierarchy", () => {
  it("promotes the highest-priority smart action as the resident next best step", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-dashboard-client.tsx"),
      "utf8"
    )

    expect(source).toContain("const visibleActions = actions.slice(0, 5)")
    expect(source).toContain("const primaryAction = visibleActions[0]")
    expect(source).toContain("Next best step")
    expect(source).toContain("Also keep an eye on")
    expect(source).toContain('emphasis?: "default" | "primary"')
  })

  it("turns the resident health score into concrete next-step links", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-dashboard-client.tsx"),
      "utf8"
    )

    expect(source).toContain("buildResidentHealthNextSteps")
    expect(source).toContain("Improve your score")
    expect(source).toContain("Complete profile")
    expect(source).toContain("Clear fee dues")
    expect(source).toContain("Open notices")
    expect(source).toContain("Check complaints")
    expect(source).toContain("Track leave")
  })
})
