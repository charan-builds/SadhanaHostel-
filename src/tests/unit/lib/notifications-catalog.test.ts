import { describe, expect, it } from "vitest"

import {
  paymentDueTemplateForDays,
  priorityForOverdueDays,
  resolveNotificationCatalog,
} from "@/lib/notifications/catalog"

describe("notification catalog", () => {
  it("classifies requested finance due windows", () => {
    expect(paymentDueTemplateForDays(7)).toBe("payment_due_7_days")
    expect(paymentDueTemplateForDays(3)).toBe("payment_due_3_days")
    expect(paymentDueTemplateForDays(1)).toBe("payment_due_tomorrow")
    expect(paymentDueTemplateForDays(0)).toBe("payment_due_today")
    expect(paymentDueTemplateForDays(-4)).toBe("payment_overdue")
  })

  it("maps categories and priorities for finance, hostel, and personal notifications", () => {
    expect(resolveNotificationCatalog({ templateKey: "payment_due_today" })).toEqual({
      category: "finance",
      priority: "urgent",
    })
    expect(resolveNotificationCatalog({ templateKey: "emergency_announcement" })).toEqual({
      category: "hostel",
      priority: "critical",
    })
    expect(resolveNotificationCatalog({ templateKey: "leave_rejected" })).toEqual({
      category: "personal",
      priority: "warning",
    })
    expect(resolveNotificationCatalog({ noticeId: "notice-id" })).toEqual({
      category: "hostel",
      priority: "info",
    })
  })

  it("escalates long-overdue reminders to critical", () => {
    expect(priorityForOverdueDays(2)).toBe("urgent")
    expect(priorityForOverdueDays(30)).toBe("critical")
  })
})
