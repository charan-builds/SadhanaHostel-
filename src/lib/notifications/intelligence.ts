import type { NotificationRow } from "@/repositories/notifications.repository"

import {
  notificationCategories,
  notificationPriorities,
  type NotificationCategory,
  type NotificationPriority,
} from "./catalog"

export type NotificationReminderAction = {
  id: string
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low"
  count: number
}

export type NotificationIntelligence = {
  total: number
  unread: number
  read: number
  readPercentage: number
  failed: number
  queued: number
  scheduled: number
  criticalUnread: number
  urgentUnread: number
  staleUnread: number
  categories: Record<NotificationCategory, number>
  priorities: Record<NotificationPriority, number>
  topPriority: NotificationPriority | "none"
  nextAction: NotificationReminderAction | null
  reminderActions: NotificationReminderAction[]
}

const priorityRank: Record<NotificationPriority, number> = {
  critical: 4,
  urgent: 3,
  warning: 2,
  info: 1,
}

const staleUnreadMs = 24 * 60 * 60 * 1000
const scheduledSoonMs = 24 * 60 * 60 * 1000

export function buildNotificationIntelligence(
  notifications: readonly NotificationRow[],
  now: Date = new Date()
): NotificationIntelligence {
  const categories = createCategoryCounts()
  const priorities = createPriorityCounts()
  const nowMs = now.getTime()

  let unread = 0
  let failed = 0
  let queued = 0
  let scheduled = 0
  let criticalUnread = 0
  let urgentUnread = 0
  let staleUnread = 0
  let scheduledSoon = 0

  for (const notification of notifications) {
    const category = normalizeCategory(notification.category)
    const priority = normalizePriority(notification.priority)

    categories[category] += 1
    priorities[priority] += 1

    const isUnread = !notification.read_at
    if (isUnread) {
      unread += 1
    }

    if (notification.status === "failed") {
      failed += 1
    }

    if (notification.status === "queued") {
      queued += 1
    }

    if (notification.scheduled_for) {
      scheduled += 1
      const scheduledMs = new Date(notification.scheduled_for).getTime()
      if (Number.isFinite(scheduledMs) && scheduledMs <= nowMs + scheduledSoonMs) {
        scheduledSoon += 1
      }
    }

    if (!isUnread) {
      continue
    }

    if (priority === "critical") {
      criticalUnread += 1
    }

    if (priority === "urgent") {
      urgentUnread += 1
    }

    const createdMs = new Date(notification.created_at).getTime()
    if (
      Number.isFinite(createdMs) &&
      nowMs - createdMs >= staleUnreadMs &&
      priorityRank[priority] >= priorityRank.warning
    ) {
      staleUnread += 1
    }
  }

  const reminderActions = buildReminderActions({
    failed,
    criticalUnread,
    urgentUnread,
    staleUnread,
    scheduledSoon,
  })
  const read = notifications.length - unread

  return {
    total: notifications.length,
    unread,
    read,
    readPercentage: notifications.length === 0 ? 0 : Math.round((read / notifications.length) * 100),
    failed,
    queued,
    scheduled,
    criticalUnread,
    urgentUnread,
    staleUnread,
    categories,
    priorities,
    topPriority: findTopPriority(priorities),
    nextAction: reminderActions[0] ?? null,
    reminderActions,
  }
}

function buildReminderActions(input: {
  failed: number
  criticalUnread: number
  urgentUnread: number
  staleUnread: number
  scheduledSoon: number
}): NotificationReminderAction[] {
  const actions: NotificationReminderAction[] = []

  if (input.failed > 0) {
    actions.push({
      id: "failed-delivery",
      title: "Review failed deliveries",
      description: "Failed notifications need provider, contact, or retry follow-up.",
      severity: "critical",
      count: input.failed,
    })
  }

  if (input.criticalUnread > 0) {
    actions.push({
      id: "critical-unread",
      title: "Handle critical unread alerts",
      description: "Critical hostel or safety messages should be read before routine work.",
      severity: "critical",
      count: input.criticalUnread,
    })
  }

  if (input.urgentUnread > 0) {
    actions.push({
      id: "urgent-unread",
      title: "Clear urgent unread items",
      description: "Urgent payment, account, or resident actions are waiting for attention.",
      severity: "high",
      count: input.urgentUnread,
    })
  }

  if (input.staleUnread > 0) {
    actions.push({
      id: "stale-unread",
      title: "Follow up stale unread messages",
      description: "Warning or urgent messages older than 24 hours may need a reminder.",
      severity: "medium",
      count: input.staleUnread,
    })
  }

  if (input.scheduledSoon > 0) {
    actions.push({
      id: "scheduled-soon",
      title: "Check scheduled reminders",
      description: "Queued reminders are scheduled for the next 24 hours.",
      severity: "low",
      count: input.scheduledSoon,
    })
  }

  return actions
}

function findTopPriority(priorities: Record<NotificationPriority, number>) {
  let topPriority: NotificationPriority | "none" = "none"
  let topRank = 0

  for (const priority of notificationPriorities) {
    if (priorities[priority] > 0 && priorityRank[priority] > topRank) {
      topPriority = priority
      topRank = priorityRank[priority]
    }
  }

  return topPriority
}

function createCategoryCounts() {
  return notificationCategories.reduce(
    (counts, category) => {
      counts[category] = 0
      return counts
    },
    {} as Record<NotificationCategory, number>
  )
}

function createPriorityCounts() {
  return notificationPriorities.reduce(
    (counts, priority) => {
      counts[priority] = 0
      return counts
    },
    {} as Record<NotificationPriority, number>
  )
}

function normalizeCategory(value: string | null): NotificationCategory {
  return notificationCategories.includes(value as NotificationCategory)
    ? (value as NotificationCategory)
    : "personal"
}

function normalizePriority(value: string | null): NotificationPriority {
  return notificationPriorities.includes(value as NotificationPriority)
    ? (value as NotificationPriority)
    : "info"
}
