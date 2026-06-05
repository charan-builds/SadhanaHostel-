import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("admin website CMS owner experience", () => {
  const source = () =>
    readFileSync(
      path.join(process.cwd(), "src/components/admin/website/admin-website-client.tsx"),
      "utf8"
    )

  it("does not expose a raw content editor", () => {
    const file = source()

    expect(file).not.toContain("contentJson")
    expect(file).not.toContain("Content JSON")
    expect(file).not.toContain("JSON.stringify")
    expect(file).not.toContain("JSON.parse")
  })

  it("offers owner-friendly structured CMS fields", () => {
    const file = source()

    expect(file).toContain("Hero title")
    expect(file).toContain("Hero subtitle")
    expect(file).toContain("Primary button text")
    expect(file).toContain("Primary button link")
    expect(file).toContain("Heading")
    expect(file).toContain("Description")
    expect(file).toContain("Add FAQ")
    expect(file).toContain("Facility Cards")
    expect(file).toContain("Gallery Images")
    expect(file).toContain("Upload images")
  })

  it("keeps live and SEO previews wired to the same form content", () => {
    const file = source()

    expect(file).toContain("WebsitePreviewPanel")
    expect(file).toContain("Live Preview")
    expect(file).toContain("SEO Preview")
    expect(file).toContain("Open graph preview image")
    expect(file).toContain("const previewContent = setting ? buildSettingContent")
  })

  it("preserves unknown stored content keys while converting structured fields", () => {
    const file = source()

    expect(file).toContain("const content = { ...contentRecord(setting.content) }")
    expect(file).toContain("content[field.key] = parseFieldValue(value, field)")
  })
})
