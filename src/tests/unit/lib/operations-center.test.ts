import { describe, expect, it } from "vitest"

import { buildOperationsCenterModel } from "@/lib/operations-center/operations-center"
import type { FinanceDashboard } from "@/lib/finance/finance-dashboard"
import type { OwnerAnalytics } from "@/sdk"
import type { VacancyPayload } from "@/sdk/admissions.sdk"
import type { LeadRow, ReservationRow } from "@/types/admissions"
import type { Tables } from "@/types/database"
import type { ResidentWithOnboarding } from "@/repositories/residents.repository"

describe("operations center model", () => {
  it("combines daily operations into a priority-ranked queue", () => {
    const model = buildOperationsCenterModel({
      pendingPayments: [
        payment({
          id: "payment-critical",
          amount: 30_000,
          created_at: "2026-06-06T10:00:00.000Z",
        }),
      ],
      supportRequests: [
        supportRequest({
          id: "support-urgent",
          priority: "urgent",
          updated_at: "2026-06-07T08:00:00.000Z",
        }),
      ],
      leaves: [leaveRequest({ id: "leave-1" })],
      leads: [lead({ id: "lead-1", next_follow_up_at: "2026-06-07T09:00:00.000Z" })],
      reservations: [reservation({ id: "reservation-1" })],
      onboardingQueue: [resident({ id: "resident-1" })],
      today: new Date("2026-06-07T12:00:00.000Z"),
    })

    expect(model.queue.map((item) => item.priority)).toEqual([
      "critical",
      "critical",
      "high",
      "medium",
      "medium",
      "medium",
    ])
    expect(model.queue.map((item) => item.source)).toEqual([
      "complaint",
      "payment",
      "admission",
      "admission",
      "leave",
      "onboarding",
    ])
    expect(model.counts).toMatchObject({
      pendingAdmissions: 2,
      pendingPayments: 1,
      pendingComplaints: 1,
      pendingLeaves: 1,
      onboardingTasks: 1,
    })
    expect(model.summary).toContain("critical")
  })

  it("computes operational health for revenue, occupancy, complaints, and communication", () => {
    const model = buildOperationsCenterModel({
      ownerAnalytics: ownerAnalytics({
        communications: {
          noticeAcknowledgementRates: {
            totalRecipients: 15,
            acknowledged: 3,
            pending: 12,
            percentage: 20,
          },
          noticeReadRates: {
            totalRecipients: 15,
            read: 6,
            unread: 9,
            percentage: 40,
          },
        },
      }),
      financeDashboard: financeDashboard({
        pendingAmount: 80_000,
        overdueAmount: 55_000,
      }),
      vacancy: vacancyPayload({
        total_beds: 100,
        occupied_beds: 58,
        available_beds: 40,
        reserved_beds: 2,
      }),
      supportRequests: [
        supportRequest({ id: "support-1" }),
        supportRequest({ id: "support-2" }),
        supportRequest({ id: "support-3" }),
        supportRequest({ id: "support-4" }),
        supportRequest({ id: "support-5" }),
        supportRequest({ id: "support-6" }),
      ],
    })

    expect(model.health.map((widget) => [widget.id, widget.priority])).toEqual([
      ["revenue", "critical"],
      ["occupancy", "medium"],
      ["complaints", "high"],
      ["communication", "high"],
    ])
    expect(model.counts.noticeFollowups).toBe(12)
  })

  it("reports a clear daily queue when no P0 or P1 work is present", () => {
    const model = buildOperationsCenterModel({
      vacancy: vacancyPayload({
        total_beds: 100,
        occupied_beds: 90,
        available_beds: 10,
        reserved_beds: 0,
      }),
    })

    expect(model.queue).toEqual([])
    expect(model.summary).toContain("operations are clear")
    expect(model.health.every((widget) => widget.priority === "low")).toBe(true)
  })
})

function ownerAnalytics(
  overrides: {
    communications?: Partial<OwnerAnalytics["communications"]>
  } = {}
): OwnerAnalytics {
  return {
    range: {
      fromDate: "2026-01-01",
      toDate: "2026-06-07",
    },
    summary: {
      revenue: 0,
      billed: 0,
      pendingDues: 0,
      unpaidResidents: 0,
      totalResidents: 0,
      activeResidents: 0,
      billingResidents: 0,
      monthlyGrowth: 0,
      paymentConversion: 0,
      residentChurn: 0,
      averageStayDurationDays: 180,
    },
    onboarding: {
      totalResidents: 0,
      completed: 0,
      completionRate: 0,
      pending: {},
    },
    duesAging: [],
    trends: [],
    forecasts: {
      revenue: {
        nextMonthExpectedBilling: 0,
        expectedCollectionRate: 0,
        expectedCollectedRevenue: 0,
        riskAdjustedPendingDues: 0,
      },
    },
    communications: {
      unreadNotifications: 0,
      unreadNotices: 0,
      unreadResidents: 0,
      overdueResidents: 0,
      noticeReadRate: 0,
      noticeReadRates: {
        totalRecipients: 0,
        read: 0,
        unread: 0,
        percentage: 0,
      },
      noticeAcknowledgementRate: 0,
      noticeAcknowledgementRates: {
        totalRecipients: 0,
        acknowledged: 0,
        pending: 0,
        percentage: 0,
      },
      feeReminderEngagement: {
        sent: 0,
        read: 0,
        percentage: 0,
      },
      ...overrides.communications,
    },
    insights: [],
    generatedAt: "2026-06-07T00:00:00.000Z",
  }
}

function financeDashboard(
  overrides: {
    pendingAmount?: number
    overdueAmount?: number
  } = {}
): FinanceDashboard {
  return {
    kpis: {
      pendingAmount: overrides.pendingAmount ?? 0,
      overdueAmount: overrides.overdueAmount ?? 0,
    },
  } as unknown as FinanceDashboard
}

function vacancyPayload(summary: Partial<NonNullable<VacancyPayload["summary"]>>): VacancyPayload {
  return {
    hostels: [],
    rooms: [],
    summary: summary as VacancyPayload["summary"],
  } as VacancyPayload
}

function payment(overrides: Partial<Tables<"payments">> = {}): Tables<"payments"> {
  return {
    id: "payment-1",
    resident_id: "resident-1",
    amount: 5000,
    status: "pending",
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as Tables<"payments">
}

function supportRequest(
  overrides: Partial<Tables<"support_requests">> = {}
): Tables<"support_requests"> {
  return {
    id: "support-1",
    subject: "Room fan issue",
    category: "maintenance",
    status: "open",
    priority: "medium",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as Tables<"support_requests">
}

function leaveRequest(
  overrides: Partial<Tables<"leave_requests">> = {}
): Tables<"leave_requests"> {
  return {
    id: "leave-1",
    from_date: "2026-06-10",
    to_date: "2026-06-12",
    status: "pending",
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as Tables<"leave_requests">
}

function lead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead-1",
    full_name: "Future Resident",
    next_follow_up_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as LeadRow
}

function reservation(overrides: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: "reservation-1",
    reserved_bed_count: 1,
    reserved_until: "2026-06-15",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as ReservationRow
}

function resident(overrides: Partial<ResidentWithOnboarding> = {}): ResidentWithOnboarding {
  return {
    id: "resident-1",
    full_name: "Resident",
    updated_at: "2026-06-01T00:00:00.000Z",
    onboarding_status: "verification_pending",
    ...overrides,
  } as ResidentWithOnboarding
}
