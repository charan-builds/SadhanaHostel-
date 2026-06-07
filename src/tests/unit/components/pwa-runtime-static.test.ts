import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("PWA runtime mounting", () => {
  it("keeps the service-worker registration helper mounted in app providers", () => {
    const providers = readFileSync(
      join(root, "src/components/providers/app-providers.tsx"),
      "utf8"
    )
    const runtime = readFileSync(
      join(root, "src/components/providers/pwa-runtime-client.tsx"),
      "utf8"
    )

    expect(providers).toContain("PwaRuntimeClient")
    expect(providers).toContain("<PwaRuntimeClient />")
    expect(runtime).toContain("\"use client\"")
    expect(runtime).toContain("registerSadhanaServiceWorker")
    expect(runtime).toMatch(/useEffect\(\(\) =>/)
  })
})
