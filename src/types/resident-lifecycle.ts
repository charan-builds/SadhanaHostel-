export type ResidentLifecycleStageKey =
  | "draft"
  | "invited"
  | "profile_incomplete"
  | "verified"
  | "active"
  | "leave_pending"
  | "leave_approved"
  | "fee_due"
  | "advance_covered"
  | "checkout_pending"
  | "checked_out"

export type ResidentLifecycleTone = "red" | "yellow" | "green" | "blue" | "neutral"

export type ResidentLifecycleCard = {
  residentId: string
  residentName: string
  admissionNumber: string | null
  phone: string | null
  hostelId: string
  roomId: string | null
  roomLabel: string | null
  status: string
  onboardingStatus: string | null
  primaryStage: ResidentLifecycleStageKey
  stages: ResidentLifecycleStageKey[]
  tone: ResidentLifecycleTone
  healthScore: number
  healthReasons: string[]
  dueAmount: number
  advanceBalance: number
  leaveStatus: string | null
  joinedOn: string | null
  checkoutOn: string | null
  searchIndex: string
}

export type ResidentLifecycleColumn = {
  key: ResidentLifecycleStageKey
  title: string
  tone: ResidentLifecycleTone
  cards: ResidentLifecycleCard[]
}

export type ResidentLifecycleControlCenter = {
  generatedAt: string
  counts: Record<ResidentLifecycleStageKey, number>
  columns: ResidentLifecycleColumn[]
  allCards: ResidentLifecycleCard[]
  health: {
    averageScore: number
    critical: number
    attention: number
    healthy: number
  }
}
