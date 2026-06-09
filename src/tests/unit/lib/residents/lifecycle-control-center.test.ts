import { describe, expect, it } from "vitest"

import { buildResidentLifecycleControlCenter } from "@/lib/residents/lifecycle-control-center"

describe("resident lifecycle control center helpers", () => {
  it("classifies resident stages, tones, and health scores", () => {
    const center = buildResidentLifecycleControlCenter({
      today: "2026-06-09",
      residents: [
        resident({
          id: "resident-due",
          full_name: "Due Resident",
          status: "active",
          onboarding_status: "verified",
          user_id: "user-due",
        }),
        resident({
          id: "resident-advance",
          full_name: "Advance Covered",
          status: "active",
          onboarding_status: "verified",
          user_id: "user-advance",
        }),
        resident({
          id: "resident-incomplete",
          full_name: "Incomplete Resident",
          status: "draft",
          onboarding_status: "profile_incomplete",
          user_id: null,
        }),
      ],
      invites: [
        {
          resident_id: "resident-incomplete",
          status: "pending",
          expires_at: "2026-06-30T00:00:00.000Z",
          used_at: null,
          revoked_at: null,
        },
      ],
      feeRecords: [
        {
          resident_id: "resident-due",
          balance_amount: 3000,
          status: "overdue",
          due_date: "2026-06-05",
          period_month: "2026-06-01",
        },
      ],
      leaves: [
        {
          resident_id: "resident-due",
          status: "pending",
          from_date: "2026-06-10",
          to_date: "2026-06-12",
        },
      ],
      rooms: [
        {
          resident_id: "resident-due",
          room_id: "room-101",
          room_label: "101-A",
        },
      ],
      advances: [
        {
          residentId: "resident-advance",
          remainingAdvanceBalance: 15000,
        },
      ],
    })

    expect(center.counts).toMatchObject({
      draft: 1,
      invited: 1,
      profile_incomplete: 1,
      active: 2,
      verified: 2,
      fee_due: 1,
      leave_pending: 1,
      advance_covered: 1,
    })

    const due = center.allCards.find((card) => card.residentId === "resident-due")
    const advance = center.allCards.find(
      (card) => card.residentId === "resident-advance"
    )
    const incomplete = center.allCards.find(
      (card) => card.residentId === "resident-incomplete"
    )

    expect(due).toMatchObject({
      primaryStage: "fee_due",
      tone: "red",
      dueAmount: 3000,
      leaveStatus: "pending",
      healthReasons: ["Fee due", "Overdue balance", "Leave pending"],
    })
    expect(due?.healthScore).toBe(35)
    expect(advance).toMatchObject({
      primaryStage: "advance_covered",
      tone: "blue",
      advanceBalance: 15000,
      healthScore: 100,
      healthReasons: ["Advance covered"],
    })
    expect(incomplete).toMatchObject({
      primaryStage: "profile_incomplete",
      tone: "yellow",
    })
    expect(center.health).toMatchObject({
      critical: 1,
      attention: 1,
      healthy: 1,
    })
  })
})

function resident(overrides: {
  id: string
  full_name: string
  status: string
  onboarding_status: string | null
  user_id: string | null
}) {
  return {
    admission_number: null,
    phone: null,
    hostel_id: "hostel-1",
    is_active: true,
    joined_on: "2026-06-01",
    checkout_on: null,
    ...overrides,
  }
}
