import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("public conversion and premium UI surfaces", () => {
  it("renders a visible admissions path before visitors reach the inquiry form", () => {
    const page = readFileSync(join(root, "src/app/(public)/page.tsx"), "utf8")
    const source = readFileSync(
      join(root, "src/components/public/admission-path-section.tsx"),
      "utf8"
    )

    expect(page).toContain("AdmissionPathSection")
    expect(source).toContain("Visitor to inquiry to admission")
    expect(source).toContain("Check availability")
    expect(source).toContain("Speak with the office")
    expect(source).toContain("Visit the hostel")
    expect(source).toContain("Complete admission")
    expect(source).toContain('href="#inquiry"')
  })

  it("keeps trust, contact, and responsive premium presentation in the admissions band", () => {
    const source = readFileSync(
      join(root, "src/components/public/admission-path-section.tsx"),
      "utf8"
    )

    expect(source).toContain("Clear monthly fee before joining")
    expect(source).toContain("Direct hostel office callback")
    expect(source).toContain("Room visit before admission")
    expect(source).toContain("sm:grid-cols-3")
    expect(source).toContain("sm:grid-cols-2")
    expect(source).toContain("hover:border-blue-200")
  })
})
