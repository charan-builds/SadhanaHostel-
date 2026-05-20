import "server-only"

import { ADMIN_ROLES } from "@/constants/auth"
import {
  buildTenantCacheKey,
  getOrSetCache,
} from "@/lib/cache"
import { measureAsync } from "@/lib/performance"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AnalyticsRepository } from "@/repositories/analytics.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  advancedAnalyticsSchema,
  dashboardAnalyticsSchema,
} from "@/validations/analytics.validation"

import { AuthService } from "./auth.service"

const DASHBOARD_CACHE_TTL_MS = 30_000

export class AnalyticsService {
  private readonly authService: AuthService
  private readonly analyticsRepository: AnalyticsRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.analyticsRepository = new AnalyticsRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new AnalyticsService(db)
  }

  async getAdminDashboard(input: unknown) {
    const values = dashboardAnalyticsSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const cacheKey = buildTenantCacheKey({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      scope: "analytics",
      identifier: "admin-dashboard",
    })

    return getOrSetCache(
      cacheKey,
      {
        ttlMs: DASHBOARD_CACHE_TTL_MS,
        tags: [`tenant:${values.organizationId}:analytics`],
      },
      () =>
        measureAsync(
          {
            name: "admin_dashboard_analytics",
            kind: "service",
            slowMs: 800,
            tags: {
              organizationId: values.organizationId,
              hostelId: values.hostelId,
            },
          },
          async () => this.loadAdminDashboard(values.organizationId, values.hostelId)
        )
    )
  }

  async getAdvancedAnalytics(input: unknown) {
    const values = advancedAnalyticsSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "staff"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const range = normalizeAnalyticsRange(values.fromDate, values.toDate)
    const cacheKey = buildTenantCacheKey({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
      scope: "analytics",
      identifier: `advanced:${range.fromDate}:${range.toDate}`,
    })

    return getOrSetCache(
      cacheKey,
      {
        ttlMs: 5 * 60 * 1000,
        tags: [`tenant:${values.organizationId}:analytics`],
      },
      () =>
        measureAsync(
          {
            name: "advanced_analytics",
            kind: "service",
            slowMs: 1200,
            tags: {
              organizationId: values.organizationId,
              hostelId: values.hostelId,
            },
          },
          () =>
            this.loadAdvancedAnalytics(
              values.organizationId,
              range.fromDate,
              range.toDate,
              values.hostelId
            )
        )
    )
  }

  private async loadAdminDashboard(organizationId: string, hostelId?: string) {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const [
      totalResidents,
      capacity,
      occupiedBeds,
      monthlyRevenue,
      pendingDues,
      recentPayments,
      recentLeaves,
    ] = await Promise.all([
      this.analyticsRepository.countActiveResidents(organizationId, hostelId),
      this.analyticsRepository.getRoomCapacity(organizationId, hostelId),
      this.analyticsRepository.countActiveRoomAllocations(organizationId, hostelId),
      this.analyticsRepository.getVerifiedRevenue(
        organizationId,
        monthStart.toISOString(),
        nextMonthStart.toISOString(),
        hostelId
      ),
      this.analyticsRepository.getPendingDues(organizationId, hostelId),
      this.analyticsRepository.listRecentPayments(organizationId, hostelId),
      this.analyticsRepository.listRecentLeaves(organizationId, hostelId),
    ])

    return {
      totalResidents,
      occupancy: {
        occupiedBeds,
        capacity,
        occupancyRate: capacity === 0 ? 0 : Number(((occupiedBeds / capacity) * 100).toFixed(2)),
      },
      finance: {
        monthlyRevenue,
        pendingDues,
      },
      recentPayments,
      recentLeaves,
      generatedAt: new Date().toISOString(),
    }
  }

  private async loadAdvancedAnalytics(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    const months = buildMonthBuckets(fromDate, toDate)
    const [capacity, payments, feeRecords, allocations, leaves, residents] =
      await Promise.all([
        this.analyticsRepository.getRoomCapacity(organizationId, hostelId),
        this.analyticsRepository.listPaymentsInRange(
          organizationId,
          fromDate,
          toDate,
          hostelId
        ),
        this.analyticsRepository.listFeeRecordsInRange(
          organizationId,
          fromDate,
          toDate,
          hostelId
        ),
        this.analyticsRepository.listRoomAllocationsInRange(
          organizationId,
          fromDate,
          toDate,
          hostelId
        ),
        this.analyticsRepository.listLeavesInRange(
          organizationId,
          fromDate,
          toDate,
          hostelId
        ),
        this.analyticsRepository.listResidentsCreatedInRange(
          organizationId,
          fromDate,
          toDate,
          hostelId
        ),
      ])

    const paymentTrends = months.map((month) => {
      const monthPayments = payments.filter(
        (payment) => monthKey(payment.verified_at ?? payment.created_at) === month.key
      )
      const verified = monthPayments.filter((payment) => payment.status === "verified")

      return {
        month: month.key,
        verifiedRevenue: sum(verified.map((payment) => payment.amount)),
        paymentCount: monthPayments.length,
        verifiedCount: verified.length,
      }
    })

    const feeTrends = months.map((month) => {
      const records = feeRecords.filter(
        (record) => monthKey(record.period_month) === month.key
      )

      return {
        month: month.key,
        billedAmount: sum(records.map((record) => record.total_amount)),
        paidAmount: sum(records.map((record) => record.paid_amount)),
        pendingAmount: sum(records.map((record) => record.balance_amount)),
      }
    })

    const occupancyTrends = months.map((month) => {
      const occupied = allocations.filter((allocation) =>
        allocationOverlapsMonth(allocation.allocated_from, allocation.allocated_to, month.start, month.end)
      ).length

      return {
        month: month.key,
        occupied,
        capacity,
        occupancyRate: capacity === 0 ? 0 : Number(((occupied / capacity) * 100).toFixed(2)),
      }
    })

    const leaveFrequency = months.map((month) => {
      const monthLeaves = leaves.filter((leave) => monthKey(leave.created_at) === month.key)

      return {
        month: month.key,
        total: monthLeaves.length,
        approved: monthLeaves.filter((leave) => leave.status === "approved").length,
        rejected: monthLeaves.filter((leave) => leave.status === "rejected").length,
        pending: monthLeaves.filter((leave) => leave.status === "pending").length,
      }
    })

    const residentGrowth = months.map((month) => {
      const created = residents.filter(
        (resident) => monthKey(resident.created_at) === month.key
      )

      return {
        month: month.key,
        newResidents: created.length,
        activeResidents: created.filter((resident) => resident.status === "active").length,
      }
    })

    return {
      range: {
        fromDate,
        toDate,
      },
      occupancyTrends,
      paymentTrends,
      feeTrends,
      revenueForecast: buildRevenueForecast(feeTrends),
      leaveFrequency,
      residentGrowth,
      generatedAt: new Date().toISOString(),
    }
  }
}

function normalizeAnalyticsRange(fromDate?: string, toDate?: string) {
  const end = toDate ? new Date(toDate) : new Date()
  const start = fromDate
    ? new Date(fromDate)
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1))

  return {
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
  }
}

function buildMonthBuckets(fromDate: string, toDate: string) {
  const start = new Date(fromDate)
  const end = new Date(toDate)
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const buckets: Array<{ key: string; start: string; end: string }> = []

  while (cursor <= end) {
    const monthStart = new Date(cursor)
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999))

    buckets.push({
      key: monthKey(monthStart.toISOString()),
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
    })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return buckets
}

function monthKey(value: string) {
  return value.slice(0, 7)
}

function allocationOverlapsMonth(
  allocatedFrom: string,
  allocatedTo: string | null,
  monthStart: string,
  monthEnd: string
) {
  return allocatedFrom <= monthEnd && (!allocatedTo || allocatedTo >= monthStart)
}

function sum(values: number[]) {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(2))
}

function buildRevenueForecast(
  feeTrends: Array<{ month: string; billedAmount: number; paidAmount: number; pendingAmount: number }>
) {
  const recent = feeTrends.slice(-3)
  const averageBilled = recent.length
    ? sum(recent.map((trend) => trend.billedAmount)) / recent.length
    : 0
  const averageCollectionRate = recent.length
    ? recent.reduce((total, trend) => {
        if (trend.billedAmount === 0) {
          return total
        }

        return total + trend.paidAmount / trend.billedAmount
      }, 0) / recent.length
    : 0

  return {
    nextMonthExpectedBilling: Number(averageBilled.toFixed(2)),
    expectedCollectionRate: Number((averageCollectionRate * 100).toFixed(2)),
    expectedCollectedRevenue: Number((averageBilled * averageCollectionRate).toFixed(2)),
  }
}
