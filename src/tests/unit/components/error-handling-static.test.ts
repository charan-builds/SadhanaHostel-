import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("shared error handling surfaces", () => {
  it("uses non-submit retry buttons so recovery actions are safe inside forms", () => {
    const apiErrorState = readFileSync(
      join(root, "src/components/system/api-error-state.tsx"),
      "utf8"
    )
    const retryState = readFileSync(
      join(root, "src/components/system/retry-state.tsx"),
      "utf8"
    )

    expect(apiErrorState).toContain('<Button type="button"')
    expect(retryState).toContain('<Button type="button"')
  })
})
