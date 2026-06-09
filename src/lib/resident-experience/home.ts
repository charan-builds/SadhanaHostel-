import type { Tables } from "@/types/database"
import type { NoticeWithEngagement } from "@/types/notices"
import type { ResidentPaymentLedger } from "@/types/payment-operations"
import type { CurrentResidentProfile } from "@/types/residents"

export type ResidentHomeRoute =
  | "/resident/pay-fees"
  | "/resident/payments"
  | "/resident/notices"
  | "/resident/support"
  | "/resident/leave"
  | "/resident/profile"

export type ResidentActionTone = "danger" | "warning" | "info" | "success"

export type ResidentSmartAction = {
  id: string
  title: string
  description: string
  href: ResidentHomeRoute
  cta: string
  tone: ResidentActionTone
  priority: number
}

export type ResidentTimelineType =
  | "notice"
  | "payment"
  | "support"
  | "leave"
  | "room"

export type ResidentTimelineEvent = {
  id: string
  type: ResidentTimelineType
  title: string
  description: string
  at: string
  href: ResidentHomeRoute
  status?: string | null
}

export type ResidentHealthScore = {
  score: number
  label: "Healthy" | "Needs attention" | "At risk"
  profileCompletion: number
  paymentScore: number
  actionScore: number
  missingProfileFields: string[]
}

export type ResidentHomeExperience = {
  actions: ResidentSmartAction[]
  timeline: ResidentTimelineEvent[]
  health: ResidentHealthScore
  counts: {
    unreadNotices: number
    acknowledgementPending: number
    openComplaints: number
    pendingLeaves: number
    currentDue: number
    pendingVerification: number
  }
}

type BuildResidentHomeExperienceInput = {
  resident: CurrentResidentProfile
  ledger?: ResidentPaymentLedger | null
  notices?: NoticeWithEngagement[]
  supportRequests?: Tables<"support_requests">[]
  leaves?: Tables<"leave_requests">[]
  today?: Date
}

export function buildResidentHomeExperience({
  resident,
  ledger,
  notices = [],
  supportRequests = [],
  leaves = [],
  today = new Date(),
}: BuildResidentHomeExperienceInput): ResidentHomeExperience {
  const currentDue = ledger?.totals.currentDue ?? 0
  const overdue = ledger?.totals.overdue ?? 0
  const pendingVerification = ledger?.totals.pendingVerification ?? 0
  const primaryDueRecord = ledger?.primaryDueRecord ?? null
  const actionableNotices = notices.filter(
    (notice) => notice.requires_acknowledgement && !notice.is_acknowledged
  )
  const unreadNotices = notices.filter((notice) => !notice.is_read).length
  const openComplaints = supportRequests.filter(isOpenSupportRequest)
  const pendingLeaves = leaves.filter((leave) => leave.status === "pending")
  const profileCompletion = calculateResidentProfileCompletion(resident)
  const actions = buildSmartActions({
    resident,
    currentDue,
    overdue,
    pendingVerification,
    primaryDueRecord,
    actionableNotices,
    unreadNotices,
    openComplaints,
    pendingLeaves,
    profileCompletion,
    today,
  })
  const health = calculateResidentHealthScore({
    currentDue,
    overdue,
    pendingVerification,
    actionCount: actions.length,
    profileCompletion,
  })

  return {
    actions,
    timeline: buildResidentTimeline({
      resident,
      ledger,
      notices,
      supportRequests,
      leaves,
    }),
    health,
    counts: {
      unreadNotices,
      acknowledgementPending: actionableNotices.length,
      openComplaints: openComplaints.length,
      pendingLeaves: pendingLeaves.length,
      currentDue,
      pendingVerification,
    },
  }
}

export function calculateResidentProfileCompletion(resident: CurrentResidentProfile) {
  const fields = getResidentProfileFields(resident)
  const completed = fields.filter((field) => field.complete).length

  return {
    percentage: Math.round((completed / fields.length) * 100),
    missingFields: fields.filter((field) => !field.complete).map((field) => field.label),
  }
}

function buildSmartActions(input: {
  resident: CurrentResidentProfile
  currentDue: number
  overdue: number
  pendingVerification: number
  primaryDueRecord: Tables<"monthly_fee_records"> | null
  actionableNotices: NoticeWithEngagement[]
  unreadNotices: number
  openComplaints: Tables<"support_requests">[]
  pendingLeaves: Tables<"leave_requests">[]
  profileCompletion: ReturnType<typeof calculateResidentProfileCompletion>
  today: Date
}) {
  const actions: ResidentSmartAction[] = []
  const dueDate = input.primaryDueRecord?.due_date ?? null
  const daysUntilDue = dueDate ? daysUntilDateOnly(dueDate, input.today) : null

  if (input.overdue > 0) {
    actions.push({
      id: "payment-overdue",
      title: "Fee payment is overdue",
      description: "Clear the overdue balance and upload proof so finance can verify it.",
      href: "/resident/pay-fees",
      cta: "Pay fee",
      tone: "danger",
      priority: 10,
    })
  } else if (input.currentDue > 0 && daysUntilDue === 1) {
    actions.push({
      id: "payment-due-tomorrow",
      title: "Fee due tomorrow",
      description: "Pay now to avoid an overdue balance on your account.",
      href: "/resident/pay-fees",
      cta: "Pay fee",
      tone: "warning",
      priority: 15,
    })
  } else if (input.currentDue > 0) {
    actions.push({
      id: "payment-due",
      title: daysUntilDue === 0 ? "Fee due today" : "Fee payment pending",
      description: "Open Pay Fees, complete UPI transfer, and upload proof for review.",
      href: "/resident/pay-fees",
      cta: "Pay fee",
      tone: daysUntilDue === 0 ? "warning" : "info",
      priority: daysUntilDue === 0 ? 20 : 35,
    })
  } else if (input.pendingVerification > 0) {
    actions.push({
      id: "payment-verification",
      title: "Payment proof under review",
      description: "Your proof is waiting for finance verification.",
      href: "/resident/payments",
      cta: "Track payment",
      tone: "info",
      priority: 45,
    })
  }

  const notice = input.actionableNotices[0]
  if (notice) {
    actions.push({
      id: `notice-${notice.id}`,
      title: "Notice requires acknowledgement",
      description: notice.title,
      href: "/resident/notices",
      cta: "Open notice",
      tone: "warning",
      priority: 25,
    })
  } else if (input.unreadNotices > 0) {
    actions.push({
      id: "notices-unread",
      title: "New hostel notices",
      description: `${input.unreadNotices} notice${input.unreadNotices === 1 ? "" : "s"} waiting to be read.`,
      href: "/resident/notices",
      cta: "Read notices",
      tone: "info",
      priority: 55,
    })
  }

  const waitingComplaint = input.openComplaints.find(
    (request) => request.status === "waiting_on_resident"
  )
  const openComplaint = waitingComplaint ?? input.openComplaints[0]
  if (openComplaint) {
    actions.push({
      id: `support-${openComplaint.id}`,
      title:
        openComplaint.status === "waiting_on_resident"
          ? "Complaint needs your response"
          : "Complaint awaiting response",
      description: openComplaint.subject,
      href: "/resident/support",
      cta: "View complaint",
      tone: openComplaint.status === "waiting_on_resident" ? "warning" : "info",
      priority: openComplaint.status === "waiting_on_resident" ? 30 : 50,
    })
  }

  const pendingLeave = input.pendingLeaves[0]
  if (pendingLeave) {
    actions.push({
      id: `leave-${pendingLeave.id}`,
      title: "Leave request awaiting approval",
      description: `${pendingLeave.from_date} to ${pendingLeave.to_date}`,
      href: "/resident/leave",
      cta: "Track leave",
      tone: "info",
      priority: 60,
    })
  }

  if (input.profileCompletion.percentage < 100) {
    actions.push({
      id: "profile-incomplete",
      title: "Profile incomplete",
      description: `Add ${input.profileCompletion.missingFields.slice(0, 2).join(", ")}${input.profileCompletion.missingFields.length > 2 ? ", and more" : ""}.`,
      href: "/resident/profile",
      cta: "Update profile",
      tone: "warning",
      priority: 40,
    })
  }

  return actions.toSorted((left, right) => left.priority - right.priority)
}

function calculateResidentHealthScore(input: {
  currentDue: number
  overdue: number
  pendingVerification: number
  actionCount: number
  profileCompletion: ReturnType<typeof calculateResidentProfileCompletion>
}): ResidentHealthScore {
  const paymentScore =
    input.overdue > 0
      ? 0
      : input.currentDue > 0
        ? 55
        : input.pendingVerification > 0
          ? 80
          : 100
  const actionScore = Math.max(40, 100 - Math.min(input.actionCount, 3) * 20)
  const score = Math.round(
    input.profileCompletion.percentage * 0.4 +
      paymentScore * 0.35 +
      actionScore * 0.25
  )

  return {
    score,
    label: score >= 85 ? "Healthy" : score >= 65 ? "Needs attention" : "At risk",
    profileCompletion: input.profileCompletion.percentage,
    paymentScore,
    actionScore,
    missingProfileFields: input.profileCompletion.missingFields,
  }
}

function buildResidentTimeline(input: {
  resident: CurrentResidentProfile
  ledger?: ResidentPaymentLedger | null
  notices: NoticeWithEngagement[]
  supportRequests: Tables<"support_requests">[]
  leaves: Tables<"leave_requests">[]
}): ResidentTimelineEvent[] {
  const noticeEvents = input.notices.map((notice): ResidentTimelineEvent => ({
    id: `notice-${notice.id}`,
    type: "notice",
    title: notice.is_acknowledged
      ? "Notice acknowledged"
      : notice.is_read
        ? "Notice read"
        : "Notice published",
    description: notice.title,
    at: notice.published_at ?? notice.updated_at ?? notice.created_at,
    href: "/resident/notices",
    status: notice.is_acknowledged ? "acknowledged" : notice.is_read ? "read" : "unread",
  }))

  const paymentEvents =
    input.ledger?.payments.map((payment): ResidentTimelineEvent => ({
      id: `payment-${payment.id}`,
      type: "payment",
      title: payment.status === "verified" ? "Payment verified" : "Payment submitted",
      description: `${payment.method.toUpperCase()} payment for ${payment.amount}`,
      at: payment.verified_at ?? payment.paid_at ?? payment.created_at,
      href: "/resident/payments",
      status: payment.status,
    })) ?? []

  const supportEvents = input.supportRequests.map((request): ResidentTimelineEvent => ({
    id: `support-${request.id}`,
    type: "support",
    title:
      request.status === "resolved" || request.status === "closed"
        ? "Complaint resolved"
        : "Complaint updated",
    description: request.subject,
    at: request.resolved_at ?? request.closed_at ?? request.updated_at ?? request.created_at,
    href: "/resident/support",
    status: request.status,
  }))

  const leaveEvents = input.leaves.map((leave): ResidentTimelineEvent => ({
    id: `leave-${leave.id}`,
    type: "leave",
    title:
      leave.status === "approved"
        ? "Leave approved"
        : leave.status === "rejected"
          ? "Leave rejected"
          : "Leave requested",
    description: `${leave.from_date} to ${leave.to_date}`,
    at: leave.reviewed_at ?? leave.updated_at ?? leave.created_at,
    href: "/resident/leave",
    status: leave.status,
  }))

  const roomEvents: ResidentTimelineEvent[] = input.resident.current_room_allocation_id
    ? [
        {
          id: `room-${input.resident.current_room_allocation_id}`,
          type: "room",
          title: "Room assignment active",
          description: [
            input.resident.current_room_number
              ? `Room ${input.resident.current_room_number}`
              : "Room assigned",
            input.resident.current_bed_label
              ? `Bed ${input.resident.current_bed_label}`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
          at: input.resident.joined_on ?? input.resident.updated_at ?? input.resident.created_at,
          href: "/resident/profile",
          status: "active",
        },
      ]
    : []

  return [
    ...noticeEvents,
    ...paymentEvents,
    ...supportEvents,
    ...leaveEvents,
    ...roomEvents,
  ]
    .filter((event) => Boolean(event.at))
    .toSorted((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 10)
}

function getResidentProfileFields(resident: CurrentResidentProfile) {
  return [
    { label: "phone", complete: Boolean(resident.phone) },
    { label: "email", complete: Boolean(resident.email) },
    { label: "parent phone", complete: Boolean(resident.parent_phone) },
    {
      label: "emergency phone",
      complete: Boolean(resident.emergency_contact_phone),
    },
    { label: "address", complete: Boolean(resident.permanent_address) },
  ]
}

function isOpenSupportRequest(request: Tables<"support_requests">) {
  return ["open", "in_progress", "waiting_on_resident"].includes(request.status)
}

function daysUntilDateOnly(dateOnly: string, today: Date) {
  const target = Date.parse(`${dateOnly}T00:00:00.000Z`)
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  )

  return Math.round((target - todayUtc) / 86_400_000)
}
