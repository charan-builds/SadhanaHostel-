import { describe, expect, it } from "vitest"

import {
  buildComplaintSlaInsight,
  getComplaintPriorityLabel,
} from "@/lib/support/complaint-insights"

describe("complaint insights", () => {
  it("marks overdue active complaints for escalation", () => {
    const insight = buildComplaintSlaInsight(
      {
        priority: "high",
        status: "in_progress",
        created_at: "2026-06-08T00:00:00.000Z",
      },
      { now: new Date("2026-06-08T10:30:00.000Z") }
    )

    expect(insight.slaHours).toBe(8)
    expect(insight.isOverdue).toBe(true)
    expect(insight.requiresEscalation).toBe(true)
    expect(insight.tone).toBe("critical")
    expect(insight.label).toBe("Overdue by 3h")
  })

  it("pauses escalation while staff is waiting on the resident", () => {
    const insight = buildComplaintSlaInsight(
      {
        priority: "urgent",
        status: "waiting_on_resident",
        created_at: "2026-06-08T00:00:00.000Z",
      },
      { now: new Date("2026-06-08T10:30:00.000Z") }
    )

    expect(insight.label).toBe("Waiting on resident")
    expect(insight.isOverdue).toBe(false)
    expect(insight.requiresEscalation).toBe(false)
    expect(insight.tone).toBe("warning")
  })

  it("exposes priority response windows", () => {
    expect(getComplaintPriorityLabel("urgent")).toBe("4h SLA")
    expect(getComplaintPriorityLabel("medium")).toBe("24h SLA")
  })
})
