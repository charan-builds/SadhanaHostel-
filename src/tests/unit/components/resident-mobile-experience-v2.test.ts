import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("resident mobile experience v2", () => {
  it("renders a simplified resident home with room, fee status, and four app cards", () => {
    const source = readProjectFile("src/components/resident/resident-dashboard-client.tsx")

    expect(source).toContain("Current fee status")
    expect(source).toContain("formatRoomLabel")
    expect(source).toContain("Pay Fees")
    expect(source).toContain("Notices")
    expect(source).toContain("Notifications")
    expect(source).toContain("Profile")
    expect(source).toContain("open-resident-notifications")
    expect(source).not.toContain("useLeaves")
  })

  it("uses four touch-friendly resident bottom tabs", () => {
    const source = readProjectFile("src/components/layout/mobile-bottom-nav.tsx")
    const shell = readProjectFile("src/components/layout/dashboard-shell.tsx")

    expect(source).toContain('title: "Home"')
    expect(source).toContain('title: "Pay"')
    expect(source).toContain('title: "Notices"')
    expect(source).toContain('title: "Profile"')
    expect(source).toContain("grid-cols-4")
    expect(source).toContain("h-14")
    expect(source).not.toContain("/resident/support")
    expect(shell).toContain('area === "admin" ?')
  })

  it("keeps the resident notification center categorized and lazy-loaded", () => {
    const source = readProjectFile("src/components/layout/dashboard-user-actions.tsx")

    expect(source).toContain("Finance")
    expect(source).toContain("Hostel")
    expect(source).toContain("Personal")
    expect(source).toContain("Mark All Read")
    expect(source).toContain("Archive")
    expect(source).toContain("notificationsOpen && organizationId")
    expect(source).toContain("open-resident-notifications")
  })

  it("provides a mobile notice center with required filters and categories", () => {
    const source = readProjectFile("src/components/resident/resident-notices-client.tsx")

    expect(source).toContain('label: "All"')
    expect(source).toContain('label: "Unread"')
    expect(source).toContain('label: "Emergency"')
    expect(source).toContain('label: "Fee"')
    expect(source).toContain("Admin Notices")
    expect(source).toContain("Maintenance Notices")
    expect(source).toContain("Emergency Notices")
    expect(source).toContain("Fee Updates")
    expect(source).toContain("Acknowledge")
    expect(source).toContain("Mark as Read")
  })

  it("surfaces owner notification, notice, due, and collection metrics", () => {
    const source = readProjectFile("src/components/admin/analytics/owner-dashboard-client.tsx")

    expect(source).toContain("Overdue Residents")
    expect(source).toContain("Residents Due Today")
    expect(source).toContain("Due This Week")
    expect(source).toContain("Notice Engagement")
    expect(source).toContain("Notification Engagement")
    expect(source).toContain("Collection Conversion")
  })
})

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
