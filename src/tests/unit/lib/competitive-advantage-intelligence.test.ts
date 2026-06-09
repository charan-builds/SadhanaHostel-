import { describe, expect, it } from "vitest"

import { buildCompetitiveAdvantageModel } from "@/lib/competitive-advantage/intelligence"
import type { FinanceDashboard } from "@/lib/finance/finance-dashboard"
import type { OwnerAnalytics } from "@/sdk"
import type { VacancyPayload } from "@/sdk/admissions.sdk"
import type { LeadRow, ReservationRow } from "@/types/admissions"
import type { Tables } from "@/types/database"
import type { NoticeWithEngagement } from "@/types/notices"
import type { ResidentWithOnboarding } from "@/repositories/residents.repository"

describe("competitive advantage intelligence", () => {
  it("prioritizes payment risk, automated followups, and notice acknowledgement gaps", () => {
    const model = buildCompetitiveAdvantageModel({
      ownerAnalytics: ownerAnalytics({
        summary: {
          pendingDues: 62_000,
          unpaidResidents: 4,
        },
        communications: {
          noticeAcknowledgementRates: {
            totalRecipients: 4,
            acknowledged: 1,
            pending: 3,
            percentage: 25,
          },
        },
      }),
      financeDashboard: financeDashboard({
        pendingAmount: 62_000,
        overdueAmount: 71_000,
        residentsWithPending: 4,
        criticalAttention: 1,
        highAttention: 2,
      }),
      pendingPayments: [
        payment({
          id: "payment-high",
          amount: 12_000,
          created_at: "2026-06-06T10:00:00.000Z",
        }),
      ],
      failedPayments: [payment({ id: "payment-failed", status: "failed" })],
      notices: [
        notice({
          id: "notice-ack",
          title: "Mess closure",
          requires_acknowledgement: true,
          pending_count: 3,
          acknowledgement_percentage: 25,
        }),
      ],
      leads: [lead({ id: "lead-due", next_follow_up_at: "2026-06-07T09:00:00.000Z" })],
      onboardingQueue: [resident({ id: "resident-onboarding" })],
      today: new Date("2026-06-07T12:00:00.000Z"),
    })

    expect(model.paymentRisk.priority).toBe("critical")
    expect(model.paymentRisk.signals.map((signal) => signal.id)).toEqual([
      "overdue-dues",
      "payment-verification",
      "failed-payments",
    ])
    expect(model.paymentRisk.highRiskResidents).toBe(3)
    expect(model.automatedFollowups.map((followup) => followup.id)).toEqual([
      "payment-reminders",
      "onboarding-review",
      "admission-followups",
      "notice-followup",
    ])
    expect(model.noticeInsights).toMatchObject({
      acknowledgementRate: 25,
      pendingAcknowledgements: 3,
    })
    expect(model.noticeInsights.weakestNotice?.id).toBe("notice-ack")
  })

  it("builds a resident activity feed from payments, complaints, leave, notices, admissions, and onboarding", () => {
    const model = buildCompetitiveAdvantageModel({
      pendingPayments: [
        payment({
          id: "payment-1",
          created_at: "2026-06-02T08:00:00.000Z",
        }),
      ],
      supportRequests: [
        supportRequest({
          id: "support-1",
          priority: "urgent",
          updated_at: "2026-06-05T08:00:00.000Z",
        }),
      ],
      leaves: [
        leaveRequest({
          id: "leave-1",
          created_at: "2026-06-04T08:00:00.000Z",
        }),
      ],
      notices: [
        notice({
          id: "notice-1",
          title: "Water maintenance",
          pending_count: 2,
          published_at: "2026-06-06T08:00:00.000Z",
        }),
      ],
      leads: [
        lead({
          id: "lead-1",
          next_follow_up_at: "2026-06-03T08:00:00.000Z",
        }),
      ],
      reservations: [
        reservation({
          id: "reservation-1",
          updated_at: "2026-06-07T08:00:00.000Z",
        }),
      ],
      onboardingQueue: [
        resident({
          id: "resident-1",
          updated_at: "2026-06-01T08:00:00.000Z",
        }),
      ],
    })

    expect(model.activityFeed.map((item) => item.source)).toEqual([
      "admission",
      "notice",
      "complaint",
      "leave",
      "admission",
      "payment",
      "onboarding",
    ])
    expect(model.activityFeed[0]).toMatchObject({
      id: "reservation-reservation-1",
      priority: "high",
    })
    expect(model.activityFeed.find((item) => item.id === "support-support-1")).toMatchObject({
      priority: "critical",
      href: "/admin/alerts",
    })
  })

  it("creates vacancy intelligence, revenue forecast, retention signals, and daily digest", () => {
    const model = buildCompetitiveAdvantageModel({
      ownerAnalytics: ownerAnalytics({
        summary: {
          residentChurn: 4,
          averageStayDurationDays: 60,
        },
        forecast: {
          nextMonthExpectedBilling: 200_000,
          expectedCollectionRate: 82,
          expectedCollectedRevenue: 164_000,
          riskAdjustedPendingDues: 24_000,
        },
      }),
      vacancy: vacancyPayload({
        total_beds: 100,
        occupied_beds: 55,
        available_beds: 40,
        reserved_beds: 5,
      }),
      supportRequests: [
        supportRequest({ id: "support-1", priority: "high" }),
        supportRequest({ id: "support-2", priority: "high" }),
        supportRequest({ id: "support-3", priority: "high" }),
        supportRequest({ id: "support-4", priority: "high" }),
        supportRequest({ id: "support-5", priority: "high" }),
        supportRequest({ id: "support-6", priority: "high" }),
      ],
      onboardingQueue: [resident({ id: "resident-onboarding" })],
      notices: [
        notice({
          id: "notice-low",
          title: "Low engagement notice",
          requires_acknowledgement: true,
          total_recipients: 10,
          pending_count: 7,
          acknowledgement_percentage: 30,
          read_percentage: 50,
        }),
      ],
    })

    expect(model.vacancyIntelligence).toMatchObject({
      totalBeds: 100,
      occupiedBeds: 55,
      availableBeds: 40,
      reservedBeds: 5,
      occupancyRate: 55,
      priority: "medium",
    })
    expect(model.revenueForecast).toMatchObject({
      expectedBilling: 200_000,
      expectedCollectionRate: 82,
      expectedCollectedRevenue: 164_000,
      riskAdjustedPendingDues: 24_000,
    })
    expect(model.retentionSignals.map((signal) => signal.id)).toEqual([
      "resident-churn",
      "open-complaints",
      "onboarding-friction",
      "short-average-stay",
    ])
    expect(model.ownerDailyDigest.join(" ")).toContain("Occupancy can improve")
    expect(model.operationsAssistant).toMatchObject({
      complaintSummary: "6 high-priority complaints need owner attention.",
      occupancySummary: "Occupancy can improve. Admissions follow-up should be active today.",
    })
    expect(model.operationsAssistant.revenueSummary).toContain("Forecasted collection is 82%")
    expect(model.operationsAssistant.nextAction).toMatchObject({
      label: "Resident onboarding review",
      href: "/admin/residents/verification",
      priority: "high",
    })
    expect(model.operationsSummary).toContain("occupancy management")
  })
})

function ownerAnalytics(
  overrides: {
    summary?: Partial<OwnerAnalytics["summary"]>
    communications?: Partial<OwnerAnalytics["communications"]>
    forecast?: Partial<OwnerAnalytics["forecasts"]["revenue"]>
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
      ...overrides.summary,
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
        ...overrides.forecast,
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
    residentsWithPending?: number
    criticalAttention?: number
    highAttention?: number
  } = {}
): FinanceDashboard {
  return {
    kpis: {
      pendingAmount: overrides.pendingAmount ?? 0,
      overdueAmount: overrides.overdueAmount ?? 0,
      residentsWithPending: overrides.residentsWithPending ?? 0,
    },
    attention: {
      critical: Array.from({ length: overrides.criticalAttention ?? 0 }, (_, index) => ({
        resident: { id: `critical-${index}` },
      })),
      high: Array.from({ length: overrides.highAttention ?? 0 }, (_, index) => ({
        resident: { id: `high-${index}` },
      })),
      medium: [],
      low: [],
    },
    owner: {
      forecasts: {
        revenue: {
          nextMonthExpectedBilling: 0,
          expectedCollectionRate: 0,
          expectedCollectedRevenue: 0,
          riskAdjustedPendingDues: 0,
        },
      },
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
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as Tables<"leave_requests">
}

function notice(overrides: Partial<NoticeWithEngagement> = {}): NoticeWithEngagement {
  return {
    id: "notice-1",
    title: "Notice",
    requires_acknowledgement: false,
    published_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    total_recipients: 0,
    read_count: 0,
    unread_count: 0,
    read_percentage: 0,
    acknowledgement_count: 0,
    pending_count: 0,
    acknowledgement_percentage: 0,
    ...overrides,
  } as NoticeWithEngagement
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
    reserved_bed_count: 2,
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
