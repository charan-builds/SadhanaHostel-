import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("form experience safeguards", () => {
  it("keeps resident leave validation linked, announced, and first-error focused", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-leave-client.tsx"),
      "utf8"
    )

    expect(source).toContain('mode: "onBlur"')
    expect(source).toContain("shouldFocusError: true")
    expect(source).toContain('aria-describedby={errors.fromDate ? "fromDate-error" : undefined}')
    expect(source).toContain('aria-describedby={errors.toDate ? "toDate-error" : undefined}')
    expect(source).toContain('aria-describedby={errors.reason ? "reason-hint reason-error" : "reason-hint"}')
    expect(source).toContain("FormErrorText")
    expect(source).toContain('role="alert"')
  })
})
