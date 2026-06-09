import type {
  ResidentLifecycleCard,
  ResidentLifecycleColumn,
  ResidentLifecycleControlCenter,
  ResidentLifecycleStageKey,
  ResidentLifecycleTone,
} from "@/types/resident-lifecycle"

type LifecycleResident = {
  id: string
  full_name: string
  admission_number: string | null
  phone: string | null
  hostel_id: string
  status: string
  onboarding_status: string | null
  is_active: boolean | null
  user_id: string | null
  joined_on: string | null
  checkout_on: string | null
}

type LifecycleInvite = {
  resident_id: string
  status: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

type LifecycleFeeRecord = {
  resident_id: string
  balance_amount: number
  status: string
  due_date: string
  period_month: string
}

type LifecycleLeave = {
  resident_id: string
  status: string
  from_date: string
  to_date: string
}

type LifecycleRoom = {
  resident_id: string
  room_id: string | null
  room_label: string | null
}

type LifecycleAdvance = {
  residentId: string
  remainingAdvanceBalance: number
}

export const lifecycleStageDefinitions: Array<{
  key: ResidentLifecycleStageKey
  title: string
  tone: ResidentLifecycleTone
}> = [
  { key: "draft", title: "Draft Residents", tone: "neutral" },
  { key: "invited", title: "Invited Residents", tone: "yellow" },
  { key: "profile_incomplete", title: "Profile Incomplete", tone: "yellow" },
  { key: "verified", title: "Verified Residents", tone: "green" },
  { key: "active", title: "Active Residents", tone: "green" },
  { key: "leave_pending", title: "Leave Pending", tone: "yellow" },
  { key: "leave_approved", title: "Leave Approved", tone: "green" },
  { key: "fee_due", title: "Fee Due", tone: "red" },
  { key: "advance_covered", title: "Advance Covered", tone: "blue" },
  { key: "checkout_pending", title: "Checkout Pending", tone: "yellow" },
  { key: "checked_out", title: "Checked Out", tone: "neutral" },
]

const primaryPriority: ResidentLifecycleStageKey[] = [
  "checked_out",
  "checkout_pending",
  "fee_due",
  "leave_pending",
  "leave_approved",
  "advance_covered",
  "active",
  "verified",
  "profile_incomplete",
  "invited",
  "draft",
]

export function buildResidentLifecycleControlCenter(input: {
  residents: LifecycleResident[]
  invites: LifecycleInvite[]
  feeRecords: LifecycleFeeRecord[]
  leaves: LifecycleLeave[]
  rooms: LifecycleRoom[]
  advances: LifecycleAdvance[]
  today?: string
}): ResidentLifecycleControlCenter {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const invitesByResident = groupBy(input.invites, (invite) => invite.resident_id)
  const feesByResident = groupBy(input.feeRecords, (fee) => fee.resident_id)
  const leavesByResident = groupBy(input.leaves, (leave) => leave.resident_id)
  const roomByResident = new Map(input.rooms.map((room) => [room.resident_id, room]))
  const advanceByResident = new Map(input.advances.map((advance) => [advance.residentId, advance]))
  const allCards = input.residents.map((resident) => {
    const invite = (invitesByResident.get(resident.id) ?? []).find((item) =>
      isPendingInvite(item, today)
    )
    const feeRecords = feesByResident.get(resident.id) ?? []
    const leaves = leavesByResident.get(resident.id) ?? []
    const room = roomByResident.get(resident.id)
    const advanceBalance = advanceByResident.get(resident.id)?.remainingAdvanceBalance ?? 0
    const dueAmount = sum(
      feeRecords
        .filter((fee) => ["pending", "partial", "overdue"].includes(fee.status))
        .map((fee) => fee.balance_amount)
    )
    const activeLeave = leaves.find((leave) =>
      ["pending", "approved"].includes(leave.status)
    )
    const stages = resolveStages({
      resident,
      invite,
      dueAmount,
      advanceBalance,
      activeLeave,
    })
    const primaryStage = primaryPriority.find((stage) => stages.includes(stage)) ?? "draft"
    const health = calculateHealthScore({
      resident,
      dueAmount,
      advanceBalance,
      activeLeave,
      feeRecords,
    })

    return {
      residentId: resident.id,
      residentName: resident.full_name,
      admissionNumber: resident.admission_number,
      phone: resident.phone,
      hostelId: resident.hostel_id,
      roomId: room?.room_id ?? null,
      roomLabel: room?.room_label ?? null,
      status: resident.status,
      onboardingStatus: resident.onboarding_status,
      primaryStage,
      stages,
      tone: stageTone(primaryStage),
      healthScore: health.score,
      healthReasons: health.reasons,
      dueAmount,
      advanceBalance,
      leaveStatus: activeLeave?.status ?? null,
      joinedOn: resident.joined_on,
      checkoutOn: resident.checkout_on,
      searchIndex: [
        resident.full_name,
        resident.admission_number,
        resident.phone,
        room?.room_label,
        resident.status,
        resident.onboarding_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    } satisfies ResidentLifecycleCard
  })
  const counts = lifecycleStageDefinitions.reduce(
    (accumulator, stage) => ({
      ...accumulator,
      [stage.key]: allCards.filter((card) => card.stages.includes(stage.key)).length,
    }),
    {} as Record<ResidentLifecycleStageKey, number>
  )
  const columns: ResidentLifecycleColumn[] = lifecycleStageDefinitions.map((stage) => ({
    ...stage,
    cards: allCards
      .filter((card) => card.primaryStage === stage.key)
      .toSorted((left, right) => left.healthScore - right.healthScore),
  }))
  const averageScore =
    allCards.length === 0
      ? 0
      : Math.round(sum(allCards.map((card) => card.healthScore)) / allCards.length)

  return {
    generatedAt: new Date().toISOString(),
    counts,
    columns,
    allCards,
    health: {
      averageScore,
      critical: allCards.filter((card) => card.healthScore < 45).length,
      attention: allCards.filter(
        (card) => card.healthScore >= 45 && card.healthScore < 75
      ).length,
      healthy: allCards.filter((card) => card.healthScore >= 75).length,
    },
  }
}

function resolveStages(input: {
  resident: LifecycleResident
  invite: LifecycleInvite | undefined
  dueAmount: number
  advanceBalance: number
  activeLeave: LifecycleLeave | undefined
}): ResidentLifecycleStageKey[] {
  const stages = new Set<ResidentLifecycleStageKey>()
  const onboarding = input.resident.onboarding_status

  if (input.resident.status === "draft" || input.resident.status === "pending_finance") {
    stages.add("draft")
  }

  if (input.invite) {
    stages.add("invited")
  }

  if (
    !input.resident.user_id ||
    onboarding === "profile_incomplete" ||
    onboarding === "documents_pending" ||
    onboarding === "verification_pending" ||
    onboarding === "invited"
  ) {
    stages.add("profile_incomplete")
  }

  if (onboarding === "verified") {
    stages.add("verified")
  }

  if (input.resident.status === "active" && input.resident.is_active !== false) {
    stages.add("active")
  }

  if (input.activeLeave?.status === "pending") {
    stages.add("leave_pending")
  }

  if (input.activeLeave?.status === "approved") {
    stages.add("leave_approved")
  }

  if (input.dueAmount > 0) {
    stages.add("fee_due")
  }

  if (input.advanceBalance > 0) {
    stages.add("advance_covered")
  }

  if (input.resident.checkout_on && input.resident.status !== "checked_out") {
    stages.add("checkout_pending")
  }

  if (input.resident.status === "checked_out") {
    stages.add("checked_out")
  }

  if (stages.size === 0) {
    stages.add("draft")
  }

  return Array.from(stages)
}

function calculateHealthScore(input: {
  resident: LifecycleResident
  dueAmount: number
  advanceBalance: number
  activeLeave: LifecycleLeave | undefined
  feeRecords: LifecycleFeeRecord[]
}) {
  let score = 100
  const reasons: string[] = []

  if (input.dueAmount > 0) {
    score -= 35
    reasons.push("Fee due")
  }

  if (input.feeRecords.some((fee) => fee.status === "overdue")) {
    score -= 20
    reasons.push("Overdue balance")
  }

  if (!input.resident.user_id || input.resident.onboarding_status !== "verified") {
    score -= 30
    reasons.push("Profile incomplete")
  }

  if (input.activeLeave?.status === "pending") {
    score -= 10
    reasons.push("Leave pending")
  }

  if (input.resident.status === "suspended") {
    score -= 35
    reasons.push("Suspended")
  }

  if (input.advanceBalance > 0 && input.dueAmount === 0) {
    score += 8
    reasons.push("Advance covered")
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.length ? reasons : ["Healthy"],
  }
}

function isPendingInvite(invite: LifecycleInvite, today: string) {
  return (
    invite.status === "pending" &&
    invite.used_at === null &&
    invite.revoked_at === null &&
    invite.expires_at.slice(0, 10) >= today
  )
}

function stageTone(stage: ResidentLifecycleStageKey): ResidentLifecycleTone {
  return lifecycleStageDefinitions.find((item) => item.key === stage)?.tone ?? "neutral"
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const result = new Map<string, T[]>()

  for (const item of items) {
    const key = getKey(item)
    result.set(key, [...(result.get(key) ?? []), item])
  }

  return result
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}
