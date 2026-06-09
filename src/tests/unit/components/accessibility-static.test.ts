import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("shared accessibility safeguards", () => {
  it("announces shared error, workflow, and loading states to assistive technology", () => {
    const apiError = readFileSync(
      join(root, "src/components/system/api-error-state.tsx"),
      "utf8"
    )
    const workflowStatus = readFileSync(
      join(root, "src/components/system/workflow-status.tsx"),
      "utf8"
    )
    const loadingState = readFileSync(
      join(root, "src/components/shared/loading-state.tsx"),
      "utf8"
    )

    expect(apiError).toContain('role="alert"')
    expect(apiError).toContain('aria-live="assertive"')
    expect(apiError).toContain('aria-atomic="true"')

    expect(workflowStatus).toContain('aria-live={tone === "danger" ? "assertive" : "polite"}')
    expect(workflowStatus).toContain('aria-atomic="true"')

    expect(loadingState).toContain('role="status"')
    expect(loadingState).toContain('aria-live="polite"')
    expect(loadingState).toContain('aria-atomic="true"')
    expect(loadingState).toContain("aria-label={label}")
  })

  it("keeps shared dialog close controls labeled and non-submit", () => {
    const dialog = readFileSync(
      join(root, "src/components/ui/dialog.tsx"),
      "utf8"
    )

    expect(dialog).toContain('aria-label="Close dialog"')
    expect(dialog).toContain('<XIcon aria-hidden="true" />')
    expect(dialog).toContain('<Button type="button"')
    expect(dialog).toContain('<Button type="button" variant="outline">Close</Button>')
  })
})
