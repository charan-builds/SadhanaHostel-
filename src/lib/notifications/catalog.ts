export const notificationCategories = ["finance", "hostel", "personal"] as const
export const notificationPriorities = ["info", "warning", "urgent", "critical"] as const

export type NotificationCategory = (typeof notificationCategories)[number]
export type NotificationPriority = (typeof notificationPriorities)[number]

type NotificationCatalogEntry = {
  category: NotificationCategory
  priority: NotificationPriority
}

const notificationCatalog: Record<string, NotificationCatalogEntry> = {
  payment_due_7_days: { category: "finance", priority: "info" },
  payment_due_3_days: { category: "finance", priority: "warning" },
  payment_due_tomorrow: { category: "finance", priority: "warning" },
  payment_due_today: { category: "finance", priority: "urgent" },
  payment_overdue: { category: "finance", priority: "urgent" },
  weekly_collection_reminder: { category: "finance", priority: "warning" },
  payment_reminder: { category: "finance", priority: "warning" },
  payment_received: { category: "finance", priority: "info" },
  payment_receipt: { category: "finance", priority: "info" },
  receipt_generated: { category: "finance", priority: "info" },
  invoice_generated: { category: "finance", priority: "info" },

  notice_published: { category: "hostel", priority: "info" },
  maintenance_notice: { category: "hostel", priority: "warning" },
  water_supply_notice: { category: "hostel", priority: "warning" },
  electricity_notice: { category: "hostel", priority: "warning" },
  emergency_announcement: { category: "hostel", priority: "critical" },

  leave_approved: { category: "personal", priority: "info" },
  leave_rejected: { category: "personal", priority: "warning" },
  leave_status_parent_notification: { category: "personal", priority: "warning" },
  password_reset: { category: "personal", priority: "urgent" },
  profile_updated: { category: "personal", priority: "info" },
  resident_onboarding: { category: "personal", priority: "info" },
  "onboarding.aging.reminder": { category: "personal", priority: "warning" },
  "support.request.created": { category: "personal", priority: "info" },
  "support.request.waiting_on_resident": { category: "personal", priority: "urgent" },
}

export function resolveNotificationCatalog(input: {
  templateKey?: string | null
  noticeId?: string | null
  category?: NotificationCategory
  priority?: NotificationPriority
}): NotificationCatalogEntry {
  const catalogEntry = input.templateKey ? notificationCatalog[input.templateKey] : null

  return {
    category: input.category ?? catalogEntry?.category ?? (input.noticeId ? "hostel" : "personal"),
    priority: input.priority ?? catalogEntry?.priority ?? "info",
  }
}

export function paymentDueTemplateForDays(daysUntilDue: number) {
  if (daysUntilDue < 0) {
    return "payment_overdue"
  }

  if (daysUntilDue === 0) {
    return "payment_due_today"
  }

  if (daysUntilDue === 1) {
    return "payment_due_tomorrow"
  }

  if (daysUntilDue <= 3) {
    return "payment_due_3_days"
  }

  return "payment_due_7_days"
}

export function priorityForOverdueDays(daysOverdue: number): NotificationPriority {
  if (daysOverdue >= 30) {
    return "critical"
  }

  return daysOverdue >= 1 ? "urgent" : "warning"
}
