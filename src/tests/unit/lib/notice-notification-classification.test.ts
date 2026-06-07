import { describe, expect, it } from "vitest"

import { noticeNotificationClassification } from "@/lib/notices/notification-classification"

describe("noticeNotificationClassification", () => {
  it("marks emergency notices critical", () => {
    expect(
      noticeNotificationClassification({ notice_type: "emergency" })
    ).toEqual({
      templateKey: "emergency_announcement",
      category: "hostel",
      priority: "critical",
    })
  })

  it("routes fee update notices to finance notifications", () => {
    expect(
      noticeNotificationClassification({ notice_type: "fee_updates" })
    ).toEqual({
      templateKey: "notice_published",
      category: "finance",
      priority: "warning",
    })
  })
})
