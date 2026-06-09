import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("resident leave workflow simplification", () => {
  it("keeps the resident leave form focused on the fast required fields", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-leave-client.tsx"),
      "utf8"
    )

    expect(source).toContain("Full Name")
    expect(source).toContain("Mobile Number")
    expect(source).toContain("WhatsApp Number")
    expect(source).toContain("From Date")
    expect(source).toContain("To Date")
    expect(source).toContain("Reason")
    expect(source).toContain("Emergency Notes (optional)")
    expect(source).not.toContain("Travel mode")
    expect(source).not.toContain("Destination")
  })

  it("keeps mobile submission, notice, urgent WhatsApp, and status visibility in place", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-leave-client.tsx"),
      "utf8"
    )

    expect(source).toContain("sticky bottom-0")
    expect(source).toContain("Need urgent approval?")
    expect(source).toContain("Contact on WhatsApp")
    expect(source).toContain("Leave Submitted Successfully")
    expect(source).toContain("Waiting for review")
    expect(source).toContain("Estimated review time")
  })

  it("exposes leave management settings in admin settings", () => {
    const source = readFileSync(
      join(root, "src/components/admin/settings/admin-settings-client.tsx"),
      "utf8"
    )

    expect(source).toContain("Leave Management Settings")
    expect(source).toContain("WhatsApp Support Number")
    expect(source).toContain("Leave Review Notice")
    expect(source).toContain("Enable Urgent Leave WhatsApp Escalation")
  })
})
