import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function projectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("admin mutation rate limit contracts", () => {
  it("defines dedicated policies for staff writes and credential issuance", () => {
    const source = projectFile("src/lib/rate-limit/rate-limit.ts")

    expect(source).toContain("staffAccessWrite")
    expect(source).toContain('name: "staff_access.write"')
    expect(source).toContain("credentialIssuance")
    expect(source).toContain('name: "credentials.issue"')
  })

  it("rate-limits staff access and credential issuance mutations", () => {
    const sensitiveRoutes = [
      "src/app/api/staff-access/users/route.ts",
      "src/app/api/staff-access/users/[id]/route.ts",
      "src/app/api/staff-access/users/[id]/revoke/route.ts",
      "src/app/api/staff-access/users/[id]/reset-password/route.ts",
      "src/app/api/resident-invites/route.ts",
      "src/app/api/resident-invites/[id]/resend/route.ts",
      "src/app/api/resident-invites/[id]/revoke/route.ts",
      "src/app/api/support/requests/[id]/resident-password-reset/route.ts",
    ]

    sensitiveRoutes.forEach((route) => {
      const source = projectFile(route)

      expect(source).toContain("RATE_LIMIT_POLICIES")
      expect(source).toMatch(/rateLimit:\s*RATE_LIMIT_POLICIES\.(staffAccessWrite|credentialIssuance)/)
    })
  })

  it("rate-limits notification read-state mutations", () => {
    const readRoute = projectFile("src/app/api/notifications/[id]/read/route.ts")
    const readAllRoute = projectFile("src/app/api/notifications/read-all/route.ts")
    const archiveRoute = projectFile("src/app/api/notifications/[id]/archive/route.ts")

    expect(readRoute).toContain("rateLimit: RATE_LIMIT_POLICIES.notificationStateWrite")
    expect(readAllRoute).toContain("rateLimit: RATE_LIMIT_POLICIES.notificationStateWrite")
    expect(archiveRoute).toContain("rateLimit: RATE_LIMIT_POLICIES.notificationStateWrite")
  })
})
