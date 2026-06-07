import type {
  NotificationCategory,
  NotificationPriority,
} from "@/lib/notifications/catalog"

export type NoticeNotificationClassification = {
  templateKey: string
  category: NotificationCategory
  priority: NotificationPriority
}

export function noticeNotificationClassification(input: {
  notice_type: string | null
}): NoticeNotificationClassification {
  if (input.notice_type === "emergency") {
    return {
      templateKey: "emergency_announcement",
      category: "hostel",
      priority: "critical",
    }
  }

  if (input.notice_type === "maintenance") {
    return {
      templateKey: "maintenance_notice",
      category: "hostel",
      priority: "warning",
    }
  }

  if (input.notice_type === "fee_updates") {
    return {
      templateKey: "notice_published",
      category: "finance",
      priority: "warning",
    }
  }

  return {
    templateKey: "notice_published",
    category: "hostel",
    priority: "info",
  }
}
