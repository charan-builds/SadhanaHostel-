import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("public website transformation surfaces", () => {
  it("makes the homepage hero conversion path and trust signals visible", () => {
    const source = readFileSync(join(root, "src/components/public/home-hero.tsx"), "utf8")

    expect(source).toContain("Check Availability")
    expect(source).toContain('href="#inquiry"')
    expect(source).toContain("HeroTrustSignal")
    expect(source).toContain("hostelConfig.fees.student")
    expect(source).toContain("Food, WiFi, CCTV, water")
    expect(source).toContain("Call or WhatsApp to confirm availability")
  })

  it("explains the inquiry follow-up process before visitors submit", () => {
    const source = readFileSync(
      join(root, "src/components/forms/contact-inquiry-form.tsx"),
      "utf8"
    )

    expect(source).toContain("InquiryProcess")
    expect(source).toContain("Hostel office calls back")
    expect(source).toContain("Room and fee availability is confirmed")
    expect(source).toContain("Visit and complete admission")
  })

  it("shows the admission path as a homepage conversion step before the inquiry form", () => {
    const source = readFileSync(
      join(root, "src/components/public/admission-path-section.tsx"),
      "utf8"
    )

    expect(source).toContain("Know the joining path before you contact the hostel")
    expect(source).toContain("Visitor to inquiry to admission")
    expect(source).toContain("Check availability")
  })
})
