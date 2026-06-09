import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function projectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("cron observability contract", () => {
  it("records scheduler duration and organization outcome metrics", () => {
    const source = projectFile("src/jobs/scheduler/vercel-cron.ts")

    expect(source).toContain("recordTimingMetric")
    expect(source).toContain('"cron.duration"')
    expect(source).toContain('"cron.organizations"')
    expect(source).toContain("outcomeSummary")
    expect(source).toContain("summarizeCronResults")
  })
})
