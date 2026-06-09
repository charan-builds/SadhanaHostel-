export type ComplaintPriority = "low" | "medium" | "high" | "urgent"
export type ComplaintStatus =
  | "open"
  | "in_progress"
  | "waiting_on_resident"
  | "resolved"
  | "closed"
  | string

export type ComplaintSlaTone = "success" | "warning" | "critical" | "muted"

export type ComplaintSlaInsight = {
  dueAt: string | null
  label: string
  description: string
  slaHours: number
  isOverdue: boolean
  requiresEscalation: boolean
  tone: ComplaintSlaTone
}

const prioritySlaHours: Record<ComplaintPriority, number> = {
  urgent: 4,
  high: 8,
  medium: 24,
  low: 72,
}

const closedStatuses = new Set(["resolved", "closed"])

export function buildComplaintSlaInsight(
  request: {
    priority: ComplaintPriority
    status: ComplaintStatus
    created_at: string
  },
  options: { now?: Date } = {}
): ComplaintSlaInsight {
  const slaHours = prioritySlaHours[request.priority] ?? prioritySlaHours.medium
  const createdAt = new Date(request.created_at)
  const now = options.now ?? new Date()

  if (Number.isNaN(createdAt.getTime())) {
    return {
      dueAt: null,
      label: "SLA unavailable",
      description: "Created time is missing or invalid, so staff should review this request manually.",
      slaHours,
      isOverdue: false,
      requiresEscalation: request.priority === "urgent",
      tone: request.priority === "urgent" ? "critical" : "muted",
    }
  }

  if (closedStatuses.has(request.status)) {
    return {
      dueAt: null,
      label: "Completed",
      description: "This request has been resolved or closed.",
      slaHours,
      isOverdue: false,
      requiresEscalation: false,
      tone: "success",
    }
  }

  if (request.status === "waiting_on_resident") {
    return {
      dueAt: null,
      label: "Waiting on resident",
      description: "Staff has asked the resident for more information before the SLA can continue.",
      slaHours,
      isOverdue: false,
      requiresEscalation: false,
      tone: "warning",
    }
  }

  const dueAt = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000)
  const remainingMs = dueAt.getTime() - now.getTime()
  const isOverdue = remainingMs < 0
  const nearBreach = !isOverdue && remainingMs <= Math.min(2, slaHours / 2) * 60 * 60 * 1000

  return {
    dueAt: dueAt.toISOString(),
    label: isOverdue
      ? `Overdue by ${formatCompactDuration(Math.abs(remainingMs))}`
      : `Due in ${formatCompactDuration(remainingMs)}`,
    description: isOverdue
      ? "Escalate this request before the resident experience degrades further."
      : nearBreach
        ? "This request is close to its target response window."
        : "This request is still within its target response window.",
    slaHours,
    isOverdue,
    requiresEscalation: isOverdue || (request.priority === "urgent" && request.status === "open"),
    tone: isOverdue || request.priority === "urgent" ? "critical" : nearBreach ? "warning" : "muted",
  }
}

export function getComplaintPriorityLabel(priority: ComplaintPriority) {
  return `${prioritySlaHours[priority] ?? prioritySlaHours.medium}h SLA`
}

function formatCompactDuration(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / (60 * 1000)))

  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.ceil(minutes / 60)

  if (hours < 48) {
    return `${hours}h`
  }

  return `${Math.ceil(hours / 24)}d`
}
