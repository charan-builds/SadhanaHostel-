import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("admin notification intelligence surface", () => {
  it("uses notification APIs with smart filters and grouped priority rendering", () => {
    const source = readFileSync(
      join(root, "src/components/admin/notifications/admin-notifications-client.tsx"),
      "utf8"
    )

    expect(source).toContain("buildNotificationIntelligence")
    expect(source).toContain("useNotifications(")
    expect(source).toContain('channel: "in_app"')
    expect(source).toContain("category === \"all\" ? undefined : category")
    expect(source).toContain("priority === \"all\" ? undefined : priority")
    expect(source).toContain('unreadOnly: readFilter === "unread"')
    expect(source).toContain("groupNotificationsByPriority")
    expect(source).toContain("Mark all read")
  })

  it("keeps one-click read and archive actions available", () => {
    const hookSource = readFileSync(join(root, "src/hooks/use-notifications.ts"), "utf8")
    const componentSource = readFileSync(
      join(root, "src/components/admin/notifications/admin-notifications-client.tsx"),
      "utf8"
    )

    expect(hookSource).toContain("useArchiveNotification")
    expect(hookSource).toContain("notificationsSdk.archive")
    expect(componentSource).toContain("handleMarkRead")
    expect(componentSource).toContain("handleArchive")
    expect(componentSource).toContain("Notification archived.")
  })
})
