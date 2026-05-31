import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function projectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("auth session cache security", () => {
  it("seeds React Query auth cache from successful login responses", () => {
    const loginForm = projectFile("src/components/auth/login-form.tsx")

    expect(loginForm).toMatch(/const\s+nextSession\s*=\s*await\s+authSdk\.login/)
    expect(loginForm).toMatch(/setSession\(nextSession\)[\s\S]*router\.replace/)
    expect(loginForm).toMatch(
      /setSession\(nextSession\)\s+toast\.success\("Welcome back\."\)/
    )
    expect(loginForm).not.toMatch(/setSession\(nextSession\)[\s\S]*await\s+refreshSession\(\)/)
  })

  it("refreshes auth session deterministically through fetchQuery", () => {
    const authProvider = projectFile("src/lib/auth/auth-provider.tsx")

    expect(authProvider).toMatch(/setSession:\s*\(session:\s*SessionOverview\)\s*=>\s*void/)
    expect(authProvider).toMatch(/refreshSession:\s*\(\)\s*=>\s*Promise<SessionOverview>/)
    expect(authProvider).toMatch(/queryClient\.fetchQuery\(\{[\s\S]*queryFn:\s*loadSessionOverview/)
    expect(authProvider).toMatch(/queryClient\.setQueryData\(queryKeys\.auth\.session,\s*session\)/)
  })
})
