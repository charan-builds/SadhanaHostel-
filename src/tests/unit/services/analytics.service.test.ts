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
      notificationsRepository: {
        getCommunicationAnalytics: vi.fn().mockResolvedValue({
          unreadNotifications: 0,
          unreadNotices: 0,
          unreadResidents: 0,
          totalNoticeRecipients: 0,
          readNoticeRecipients: 0,
          unreadNoticeRecipients: 0,
          noticeReadPercentage: 0,
          feeReminderSent: 0,
          feeReminderRead: 0,
          feeReminderEngagement: 0,
        }),
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
      },
      noticesRepository: {
        listAcknowledgementRequired: vi.fn().mockResolvedValue([
          {
            id: "00000000-0000-4000-8000-000000000231",
            requires_acknowledgement: true,
          },
        ]),
      },
      notificationsRepository: {
        getCommunicationAnalytics: vi.fn().mockResolvedValue({
          unreadNotifications: 0,
          unreadNotices: 0,
          unreadResidents: 0,
          totalNoticeRecipients: 0,
          readNoticeRecipients: 0,
          unreadNoticeRecipients: 0,
          noticeReadPercentage: 0,
          feeReminderSent: 0,
          feeReminderRead: 0,
          feeReminderEngagement: 0,
        }),
        listNoticeRecipientStats: vi.fn().mockResolvedValue(
          new Map([
            [
              "00000000-0000-4000-8000-000000000231",
              {
                totalRecipients: 2,
                readCount: 1,
                unreadCount: 1,
                readPercentage: 50,
              },
            ],
          ])
        ),
      },
      noticeAcknowledgementsRepository: {
        listAcknowledgementCountsByNotice: vi
          .fn()
          .mockResolvedValue(
            new Map([["00000000-0000-4000-8000-000000000231", 1]])
          ),
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
          communications: {
            noticeAcknowledgementRates: {
              totalRecipients: number
              acknowledged: number
              pending: number
              percentage: number
            }
          }
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
    expect(result.communications.noticeAcknowledgementRates).toEqual({
      totalRecipients: 2,
      acknowledged: 1,
      pending: 1,
      percentage: 50,
    })
  })
})
