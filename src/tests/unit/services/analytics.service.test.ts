import { describe, expect, it, vi } from "vitest"

import { AnalyticsService } from "@/services/analytics.service"
import { RESIDENT_ID, TEST_HOSTEL_ID, TEST_ORGANIZATION_ID } from "@/tests/fixtures"

describe("AnalyticsService", () => {
  it("counts fee totals for active residents even when residents were created before the selected range", async () => {
    const service = new AnalyticsService({} as never)

    Object.assign(service, {
      analyticsRepository: {
        listPaymentsInRange: vi.fn().mockResolvedValue([]),
        listFeeRecordsInRange: vi.fn().mockResolvedValue([
          {
            resident_id: RESIDENT_ID,
            period_month: "2026-06-01",
            total_amount: 6500,
            paid_amount: 2500,
            balance_amount: 4000,
            status: "partial",
          },
        ]),
        listLeavesInRange: vi.fn().mockResolvedValue([]),
        listResidentsCreatedInRange: vi.fn().mockResolvedValue([]),
        listResidentLifecycleRows: vi.fn().mockResolvedValue([
          {
            id: RESIDENT_ID,
            status: "active",
            onboarding_status: "verified",
            is_active: true,
            user_id: "00000000-0000-4000-8000-000000000032",
            checkout_on: null,
          },
        ]),
      },
    })

    const result = await (
      service as unknown as {
        loadAdvancedAnalytics: (
          organizationId: string,
          fromDate: string,
          toDate: string,
          hostelId?: string
        ) => Promise<{
          feeTrends: Array<{
            month: string
            billedAmount: number
            paidAmount: number
            pendingAmount: number
          }>
        }>
      }
    ).loadAdvancedAnalytics(
      TEST_ORGANIZATION_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-06-30T23:59:59.999Z",
      TEST_HOSTEL_ID
    )

    expect(result.feeTrends).toContainEqual({
      month: "2026-06",
      billedAmount: 6500,
      paidAmount: 2500,
      pendingAmount: 4000,
    })
  })

  it("keeps owner summary revenue equal to trend revenue using verified_at", async () => {
    const service = new AnalyticsService({} as never)

    Object.assign(service, {
      analyticsRepository: {
        listOwnerResidents: vi.fn().mockResolvedValue([
          {
            id: RESIDENT_ID,
            created_at: "2025-12-15T00:00:00.000Z",
            joined_on: "2026-01-01",
            checkout_on: null,
            status: "active",
            onboarding_status: "verified",
            is_active: true,
            user_id: "00000000-0000-4000-8000-000000000032",
            monthly_fee_amount: 3500,
          },
        ]),
        listOwnerReservations: vi.fn().mockResolvedValue([]),
        listPaymentsInRange: vi.fn().mockResolvedValue([
          {
            amount: 3500,
            status: "verified",
            created_at: "2026-05-31T23:00:00.000Z",
            verified_at: "2026-06-01T01:00:00.000Z",
          },
          {
            amount: 1000,
            status: "pending",
            created_at: "2026-06-02T00:00:00.000Z",
            verified_at: null,
          },
        ]),
        listOwnerFeeRecords: vi.fn().mockResolvedValue([
          {
            resident_id: RESIDENT_ID,
            period_month: "2026-06-01",
            due_date: "2026-06-05",
            total_amount: 3500,
            paid_amount: 3500,
            balance_amount: 0,
            status: "paid",
          },
        ]),
        listOwnerRooms: vi.fn().mockResolvedValue([]),
        listRoomAllocationsInRange: vi.fn().mockResolvedValue([]),
        listOwnerSupportRequests: vi.fn().mockResolvedValue([]),
        listOwnerNoticeNotifications: vi.fn().mockResolvedValue([]),
      },
    })

    const result = await (
      service as unknown as {
        loadOwnerDashboard: (
          organizationId: string,
          fromDate: string,
          toDate: string,
          hostelId?: string
        ) => Promise<{
          summary: {
            revenue: number
            activeResidents: number
          }
          trends: Array<{
            month: string
            revenue: number
          }>
        }>
      }
    ).loadOwnerDashboard(
      TEST_ORGANIZATION_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-06-30T23:59:59.999Z",
      TEST_HOSTEL_ID
    )
    const trendRevenue = result.trends.reduce((total, trend) => total + trend.revenue, 0)

    expect(result.summary.revenue).toBe(3500)
    expect(trendRevenue).toBe(result.summary.revenue)
    expect(result.summary.activeResidents).toBe(1)
  })

  it("calculates owner widgets from the selected period", async () => {
    const service = new AnalyticsService({} as never)

    Object.assign(service, {
      analyticsRepository: {
        listOwnerResidents: vi.fn().mockResolvedValue([
          {
            id: RESIDENT_ID,
            created_at: "2026-06-02T00:00:00.000Z",
            joined_on: "2026-06-02",
            checkout_on: null,
            status: "active",
            onboarding_status: "verified",
            is_active: true,
            user_id: "00000000-0000-4000-8000-000000000032",
            monthly_fee_amount: 5000,
          },
        ]),
        listOwnerReservations: vi.fn().mockResolvedValue([]),
        listPaymentsInRange: vi.fn().mockResolvedValue([
          {
            amount: 4000,
            status: "verified",
            created_at: "2026-06-05T00:00:00.000Z",
            verified_at: "2026-06-05T00:00:00.000Z",
          },
        ]),
        listOwnerFeeRecords: vi.fn().mockResolvedValue([
          {
            resident_id: RESIDENT_ID,
            period_month: "2026-06-01",
            due_date: "2026-06-05",
            total_amount: 5000,
            paid_amount: 4000,
            balance_amount: 1000,
            status: "partial",
          },
        ]),
        listOwnerRooms: vi.fn().mockResolvedValue([
          {
            id: "room-1",
            room_number: "101",
            room_type: "double",
            capacity: 10,
            base_monthly_fee: 5000,
            status: "active",
          },
        ]),
        listRoomAllocationsInRange: vi.fn().mockResolvedValue([
          {
            resident_id: RESIDENT_ID,
            allocated_from: "2026-06-01",
            allocated_to: "2026-06-30",
            status: "active",
          },
        ]),
        listOwnerSupportRequests: vi.fn().mockResolvedValue([
          { id: "support-1" },
          { id: "support-2" },
        ]),
        listOwnerNoticeNotifications: vi.fn().mockResolvedValue([
          {
            id: "notification-1",
            notice_id: "notice-1",
            read_at: "2026-06-10T00:00:00.000Z",
          },
          {
            id: "notification-2",
            notice_id: "notice-1",
            read_at: null,
          },
        ]),
      },
    })

    const result = await (
      service as unknown as {
        loadOwnerDashboard: (
          organizationId: string,
          fromDate: string,
          toDate: string,
          hostelId?: string
        ) => Promise<{
          summary: {
            revenue: number
            overdueAmount: number
            collectionRate: number
            occupancyRate: number
            admissions: number
            complaints: number
            noticeEngagement: number
          }
          hasData: boolean
        }>
      }
    ).loadOwnerDashboard(
      TEST_ORGANIZATION_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-06-30T23:59:59.999Z",
      TEST_HOSTEL_ID
    )

    expect(result.summary).toMatchObject({
      revenue: 4000,
      overdueAmount: 1000,
      collectionRate: 80,
      occupancyRate: 10,
      admissions: 1,
      complaints: 2,
      noticeEngagement: 50,
    })
    expect(result.hasData).toBe(true)
  })

  it.each(["csv", "pdf"] as const)(
    "exports %s reports with the exact selected range",
    async (format) => {
      const service = new AnalyticsService({} as never)
      const dashboard = {
        range: {
          fromDate: "2026-05-01T00:00:00.000Z",
          toDate: "2026-05-31T23:59:59.999Z",
        },
        summary: {
          revenue: 50000,
          billed: 55000,
          pendingDues: 5000,
          overdueAmount: 2000,
          collectionRate: 90.91,
          occupancyRate: 92,
          admissions: 12,
          complaints: 3,
          noticeEngagement: 88,
          unpaidResidents: 2,
          totalResidents: 40,
          activeResidents: 38,
          billingResidents: 38,
          monthlyGrowth: 10,
          paymentConversion: 95,
          residentChurn: 2,
          averageStayDurationDays: 180,
        },
        onboarding: {
          totalResidents: 12,
          completed: 10,
          completionRate: 83.33,
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
        insights: [],
        hasData: true,
        generatedAt: "2026-06-09T12:00:00.000Z",
      }

      Object.assign(service, {
        getOwnerDashboard: vi.fn().mockResolvedValue(dashboard),
      })

      const exported = await service.exportOwnerDashboard({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
        fromDate: "2026-05-01",
        toDate: "2026-05-31",
        format,
      })

      expect(exported.fileName).toContain("2026-05-01-to-2026-05-31")

      if (format === "csv") {
        expect(String(exported.body)).toContain("Period From,2026-05-01")
        expect(String(exported.body)).toContain("Notice Engagement,88%")
      } else {
        expect(exported.contentType).toBe("application/pdf")
        expect(exported.body).toBeInstanceOf(Buffer)
        expect(exported.body.length).toBeGreaterThan(100)
      }
    }
  )
})
