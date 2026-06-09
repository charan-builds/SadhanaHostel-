import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("public inquiry form production UX", () => {
  it("keeps validation, announcements, and retry context inline", () => {
    const source = readFileSync(
      join(root, "src/components/forms/contact-inquiry-form.tsx"),
      "utf8"
    )

    expect(source).toContain("noValidate")
    expect(source).toContain("aria-live=\"polite\"")
    expect(source).toContain("aria-invalid={Boolean(fieldErrors.name)}")
    expect(source).toContain("aria-invalid={Boolean(fieldErrors.phone)}")
    expect(source).toContain("focusFirstInvalidField")
    expect(source).toContain("FrontendApiError")
    expect(source).toContain("Reference: ${error.requestId}")
  })
})
