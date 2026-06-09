import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("notices v2 surfaces", () => {
  it("exposes resident read and acknowledgement actions", () => {
    const source = readFileSync(
      join(root, "src/components/resident/resident-notices-client.tsx"),
      "utf8"
    )

    expect(source).toContain("useMarkNoticeRead")
    expect(source).toContain("useAcknowledgeNotice")
    expect(source).toContain("Mark as read")
    expect(source).toContain("Acknowledge notice")
    expect(source).toContain("requires_acknowledgement")
    expect(source).toContain("is_acknowledged")
  })

  it("exposes admin engagement and acknowledgement controls", () => {
    const source = readFileSync(
      join(root, "src/components/admin/notices/admin-notices-client.tsx"),
      "utf8"
    )

    expect(source).toContain("audienceFilter")
    expect(source).toContain("requiresAcknowledgement")
    expect(source).toContain("noticeType")
    expect(source).toContain("NoticeEngagementSummary")
    expect(source).toContain("read_percentage")
    expect(source).toContain("pending_count")
  })

  it("keeps notice read and acknowledgement mutations available through hooks", () => {
    const source = readFileSync(join(root, "src/hooks/use-notices.ts"), "utf8")

    expect(source).toContain("useMarkNoticeRead")
    expect(source).toContain("noticesSdk.markRead")
    expect(source).toContain("useAcknowledgeNotice")
    expect(source).toContain("noticesSdk.acknowledge")
  })
})
