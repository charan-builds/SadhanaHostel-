import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("admin settings branding controls", () => {
  it("keeps cropped logo upload inside organization settings", () => {
    const settingsSource = readProjectFile("src/components/admin/settings/admin-settings-client.tsx")
    const hookSource = readProjectFile("src/hooks/use-platform.ts")
    const sdkSource = readProjectFile("src/sdk/platform.sdk.ts")
    const routeSource = readProjectFile("src/app/api/platform/branding/upload/route.ts")

    expect(settingsSource).toContain("BrandLogoCropper")
    expect(settingsSource).toContain("Upload cropped logo")
    expect(settingsSource).toContain("form.setValue(\"faviconUrl\"")
    expect(hookSource).toContain("useUploadBrandingImage")
    expect(sdkSource).toContain("/api/platform/branding/upload")
    expect(routeSource).toContain("uploadBrandingImage")
  })
})

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
