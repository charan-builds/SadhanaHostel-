import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const privateRouteGroups = [
  "src/app/(admin)",
  "src/app/(auth)",
  "src/app/(resident)",
] as const

describe("private route metadata", () => {
  it("keeps admin, auth, and resident route groups on the shared noindex metadata", () => {
    for (const routeGroup of privateRouteGroups) {
      const layoutSource = readFileSync(path.join(routeGroup, "layout.tsx"), "utf8")

      expect(layoutSource).toContain('import { noIndexMetadata } from "@/lib/seo"')
      expect(layoutSource).toContain("export const metadata: Metadata = noIndexMetadata")
    }
  })

  it("does not let private pages override the inherited robots noindex metadata", () => {
    const privatePageFiles = privateRouteGroups.flatMap((routeGroup) =>
      listRouteFiles(routeGroup).filter((filePath) => !filePath.endsWith("layout.tsx"))
    )

    expect(privatePageFiles.length).toBeGreaterThan(0)

    for (const filePath of privatePageFiles) {
      const source = readFileSync(filePath, "utf8")

      expect(source, filePath).not.toMatch(/\brobots\s*:/)
      expect(source, filePath).not.toMatch(/\bmetadata\s*=\s*noIndexMetadata\b/)
    }
  })
})

function listRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = path.join(directory, entry)
    const stats = statSync(filePath)

    if (stats.isDirectory()) {
      return listRouteFiles(filePath)
    }

    return /\.(?:ts|tsx)$/.test(entry) ? [filePath] : []
  })
}
