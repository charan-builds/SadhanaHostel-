import "server-only"

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import {
  buildTenantCacheKey,
  getOrSetCache,
} from "@/lib/cache"
import { hostelModules } from "@/config/hostel-modules"
import { measureAsync } from "@/lib/performance"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AnalyticsRepository } from "@/repositories/analytics.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  advancedAnalyticsSchema,
  dashboardAnalyticsSchema,
  ownerAnalyticsExportSchema,
  ownerAnalyticsSchema,
} from "@/validations/analytics.validation"

import { AuthService } from "./auth.service"
import {
  buildResidentLifecycleSummary,
  isResidentEligibleForAnalytics,
  isResidentEligibleForBilling,
  isResidentEligibleForOccupancy,
} from "./analytics/operational-metrics"

const DASHBOARD_CACHE_TTL_MS = 0
const OWNER_ANALYTICS_CACHE_TTL_MS = 60_000

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
    const context = await this.authService.requirePermission("analytics.view")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const cacheKey = buildTenantCacheKey({
      organizationId: values.organizationId,
      hostelId: hostelId ?? undefined,
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
              hostelId: hostelId ?? undefined,
            },
          },
          async () => this.loadAdminDashboard(values.organizationId, hostelId ?? undefined)
        )
    )
  }

  async getAdvancedAnalytics(input: unknown) {
    const values = advancedAnalyticsSchema.parse(input)
    const context = await this.authService.requirePermission("analytics.view")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const range = normalizeAnalyticsRange(values.fromDate, values.toDate)
    const cacheKey = buildTenantCacheKey({
      organizationId: values.organizationId,
      hostelId: hostelId ?? undefined,
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
              hostelId: hostelId ?? undefined,
            },
          },
          () =>
            this.loadAdvancedAnalytics(
              values.organizationId,
              range.fromDate,
              range.toDate,
              hostelId ?? undefined
            )
        )
    )
  }

  async getOwnerDashboard(input: unknown) {
    const values = ownerAnalyticsSchema.parse(input)
    const context = await this.authService.requirePermission("analytics.view")
    const hostelId = this.authService.resolveHostelScope(
      context,
      values.organizationId,
      values.hostelId
    )

    const range = normalizeAnalyticsRange(values.fromDate, values.toDate)
    const cacheKey = buildTenantCacheKey({
      organizationId: values.organizationId,
      hostelId: hostelId ?? undefined,
      scope: "analytics",
      identifier: `owner:${range.fromDate}:${range.toDate}`,
    })

    return getOrSetCache(
      cacheKey,
      {
        ttlMs: OWNER_ANALYTICS_CACHE_TTL_MS,
        tags: [`tenant:${values.organizationId}:analytics`],
      },
      () =>
        measureAsync(
          {
            name: "owner_analytics",
            kind: "service",
            slowMs: 1500,
            tags: {
              organizationId: values.organizationId,
              hostelId: hostelId ?? undefined,
            },
          },
          () =>
            this.loadOwnerDashboard(
              values.organizationId,
              range.fromDate,
              range.toDate,
              hostelId ?? undefined
            )
        )
    )
  }

  async exportOwnerDashboard(input: unknown) {
    const values = ownerAnalyticsExportSchema.parse(input)
    const dashboard = await this.getOwnerDashboard(values)
    const date = new Date().toISOString().slice(0, 10)
    const scope = values.hostelId ? `-${values.hostelId.slice(0, 8)}` : ""
    const fileName = `owner-dashboard${scope}-${date}.${values.format}`

    if (values.format === "pdf") {
      return {
        fileName,
        contentType: "application/pdf",
        body: await buildOwnerAnalyticsPdf(dashboard),
      }
    }

    return {
      fileName,
      contentType: "text/csv; charset=utf-8",
      body: buildOwnerAnalyticsCsv(dashboard),
    }
  }

  private async loadAdminDashboard(organizationId: string, hostelId?: string) {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const today = now.toISOString().slice(0, 10)
    const [
      residentLifecycleRows,
      capacity,
      activeAllocations,
      monthlyRevenue,
      pendingDuesRecords,
      pendingPayments,
      activeLeaves,
      newAdmissions,
      pendingInvites,
      recentPayments,
      recentLeaves,
    ] = await Promise.all([
      this.analyticsRepository.listResidentLifecycleRows(organizationId, hostelId),
      this.analyticsRepository.getRoomCapacity(organizationId, hostelId),
      this.analyticsRepository.listActiveRoomAllocationsForOccupancy(organizationId, hostelId),
      this.analyticsRepository.getVerifiedRevenue(
        organizationId,
        monthStart.toISOString(),
        nextMonthStart.toISOString(),
        hostelId
      ),
      this.analyticsRepository.listPendingDuesRecords(organizationId, hostelId),
      this.analyticsRepository.countPendingPaymentRequests(organizationId, hostelId),
      this.analyticsRepository.countActiveLeaves(organizationId, today, hostelId),
      this.analyticsRepository.countNewAdmissionLeads(organizationId, hostelId),
      this.analyticsRepository.countPendingInvites(organizationId, now.toISOString(), hostelId),
      this.analyticsRepository.listRecentPayments(organizationId, hostelId),
      this.analyticsRepository.listRecentLeaves(organizationId, hostelId),
    ])
    const residentLifecycle = buildResidentLifecycleSummary(residentLifecycleRows)
    const occupancyEligibleResidentIds = new Set(
      residentLifecycleRows
        .filter(isResidentEligibleForOccupancy)
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const billingEligibleResidentIds = new Set(
      residentLifecycleRows
        .filter(isResidentEligibleForBilling)
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const occupiedBeds = activeAllocations.filter(
      (allocation) =>
        allocation.resident_id && occupancyEligibleResidentIds.has(allocation.resident_id)
    ).length
    const pendingDues = sum(
      pendingDuesRecords
        .filter((record) => billingEligibleResidentIds.has(record.resident_id))
        .map((record) => record.balance_amount)
    )
    const finance = {
      monthlyRevenue,
      pendingDues,
      pendingPayments,
    }
    const vacantBeds = Math.max(0, capacity - occupiedBeds)

    return {
      totalResidents: residentLifecycle.registeredResidents,
      residentLifecycle,
      occupancy: {
        occupiedBeds,
        capacity,
        vacantBeds,
        occupancyRate: capacity === 0 ? 0 : Number(((occupiedBeds / capacity) * 100).toFixed(2)),
      },
      finance,
      operations: {
        activeLeaves,
        newAdmissions,
        pendingInvites,
        pendingVerification: residentLifecycle.pendingVerification,
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
    const [capacity, payments, rawFeeRecords, allocations, leaves, residents] =
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
    const operationalResidents = residents.filter(isResidentEligibleForAnalytics)
    const analyticsEligibleResidentIds = new Set(
      operationalResidents
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const feeRecords = rawFeeRecords.filter((record) =>
      analyticsEligibleResidentIds.has(record.resident_id)
    )

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
      const occupied = allocations.filter(
        (allocation) =>
          allocation.resident_id &&
          analyticsEligibleResidentIds.has(allocation.resident_id) &&
          allocationOverlapsMonth(
            allocation.allocated_from,
            allocation.allocated_to,
            month.start,
            month.end
          )
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
      const activeCreated = created.filter(isResidentEligibleForAnalytics)

      return {
        month: month.key,
        newResidents: created.length,
        activeResidents: activeCreated.length,
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

  private async loadOwnerDashboard(
    organizationId: string,
    fromDate: string,
    toDate: string,
    hostelId?: string
  ) {
    const months = buildMonthBuckets(fromDate, toDate)
    const now = new Date()
    const [
      capacitySnapshot,
      rooms,
      allocations,
      residents,
      reservations,
      payments,
      feeRecords,
    ] = await Promise.all([
      this.analyticsRepository.getHostelCapacitySnapshot(organizationId, hostelId),
      this.analyticsRepository.listOwnerRooms(organizationId, hostelId),
      this.analyticsRepository.listOwnerAllocations(organizationId, hostelId),
      this.analyticsRepository.listOwnerResidents(organizationId, hostelId),
      this.analyticsRepository.listOwnerReservations(organizationId, fromDate, toDate, hostelId),
      this.analyticsRepository.listPaymentsInRange(organizationId, fromDate, toDate, hostelId),
      this.analyticsRepository.listOwnerFeeRecords(organizationId, fromDate, toDate, hostelId),
    ])

    const activeRooms = rooms.filter((room) => room.status === "active")
    const operationalResidents = residents.filter(isResidentEligibleForAnalytics)
    const analyticsEligibleResidentIds = new Set(
      operationalResidents
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const billingEligibleResidentIds = new Set(
      residents
        .filter(isResidentEligibleForBilling)
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const activeAllocations = allocations.filter(
      (allocation) =>
        allocation.status === "active" &&
        allocation.resident_id &&
        analyticsEligibleResidentIds.has(allocation.resident_id)
    )
    const billingFeeRecords = feeRecords.filter((record) =>
      billingEligibleResidentIds.has(record.resident_id)
    )
    const configuredBeds = activeRooms.reduce((total, room) => total + room.capacity, 0)
    const totalBeds = configuredBeds || capacitySnapshot?.total_beds || 0
    const occupiedBeds =
      activeAllocations.length
    const reservedBeds =
      capacitySnapshot?.reserved_beds ??
      reservations
        .filter((reservation) => ["reserved", "confirmed"].includes(reservation.status))
        .reduce((total, reservation) => total + reservation.reserved_bed_count, 0)
    const maintenanceBlockedBeds = capacitySnapshot?.maintenance_blocked_beds ?? 0
    const availableBeds = Math.max(0, totalBeds - occupiedBeds)
    const verifiedPayments = payments.filter((payment) => payment.status === "verified")
    const pendingFeeRecords = billingFeeRecords.filter((record) =>
      ["pending", "partial", "overdue"].includes(record.status)
    )
    const unpaidResidentIds = new Set(
      pendingFeeRecords
        .filter((record) => Number(record.balance_amount) > 0)
        .map((record) => record.resident_id)
    )
    const overdueRecords = pendingFeeRecords.filter(
      (record) => record.due_date < now.toISOString().slice(0, 10)
    )
    const completedOnboarding = operationalResidents.length
    const checkedOutInRange = residents.filter((resident) =>
      isDateInRange(resident.checkout_on, fromDate, toDate)
    ).length
    const joinedResidents = operationalResidents.filter((resident) => resident.joined_on)
    const roomUtilization = buildRoomUtilization(activeRooms, activeAllocations)
    const monthly = months.map((month) =>
      buildMonthlyOwnerBucket(month, {
        totalBeds,
        residents: operationalResidents,
        reservations,
        payments,
        feeRecords: billingFeeRecords,
        allocations: activeAllocations,
      })
    )
    const financeMonthly = hostelModules.startupFinanceZero
      ? monthly.map((item) => ({
          ...item,
          revenue: 0,
          billed: 0,
          dues: 0,
          reservationAdvance: 0,
          paymentConversion: 0,
        }))
      : monthly
    const revenue = hostelModules.startupFinanceZero
      ? 0
      : sum(verifiedPayments.map((payment) => payment.amount))
    const billed = hostelModules.startupFinanceZero
      ? 0
      : sum(billingFeeRecords.map((record) => record.total_amount))
    const pendingDues = hostelModules.startupFinanceZero
      ? 0
      : sum(pendingFeeRecords.map((record) => record.balance_amount))
    const paymentConversion =
      hostelModules.startupFinanceZero || payments.length === 0
        ? 0
        : Number(((verifiedPayments.length / payments.length) * 100).toFixed(2))
    const averageStayDurationDays = average(
      joinedResidents.map((resident) =>
        daysBetween(
          resident.joined_on,
          resident.checkout_on ?? now.toISOString().slice(0, 10)
        )
      )
    )
    const revenueForecast = buildOwnerRevenueForecast(financeMonthly)
    const occupancyForecast = buildOwnerOccupancyForecast({
      currentOccupied: occupiedBeds,
      totalBeds,
      monthly: financeMonthly,
      residents: operationalResidents,
      fromDate: now.toISOString(),
    })
    const insights = buildOwnerInsights({
      availableBeds,
      totalBeds,
      occupiedBeds,
      pendingDues,
      overdueRecords: hostelModules.startupFinanceZero ? 0 : overdueRecords.length,
      unpaidResidents: hostelModules.startupFinanceZero ? 0 : unpaidResidentIds.size,
      roomUtilization,
      onboardingIncomplete: Math.max(0, residents.length - completedOnboarding),
      paymentConversion,
    })

    return {
      range: { fromDate, toDate },
      summary: {
        occupancyRate: percent(occupiedBeds, totalBeds),
        revenue,
        billed,
        pendingDues,
        unpaidResidents: hostelModules.startupFinanceZero ? 0 : unpaidResidentIds.size,
        monthlyGrowth: calculateGrowth(financeMonthly.map((item) => item.newResidents)),
        paymentConversion,
        residentChurn: percent(checkedOutInRange, Math.max(residents.length, 1)),
        averageStayDurationDays,
      },
      capacity: {
        totalBeds,
        occupiedBeds,
        reservedBeds,
        maintenanceBlockedBeds,
        availableBeds,
        lastCalculatedAt: capacitySnapshot?.last_calculated_at ?? null,
      },
      onboarding: {
        totalResidents: residents.length,
        completed: completedOnboarding,
        completionRate: percent(completedOnboarding, residents.length),
        pending: countBy(residents, (resident) =>
          String(resident.onboarding_status ?? "unknown")
        ),
      },
      duesAging: hostelModules.startupFinanceZero ? [] : buildDuesAging(pendingFeeRecords, now),
      trends: financeMonthly,
      roomUtilization,
      forecasts: {
        occupancy: occupancyForecast,
        revenue: revenueForecast,
        expectedVacancies: occupancyForecast.expectedVacancies,
      },
      insights,
      generatedAt: new Date().toISOString(),
    }
  }
}

function normalizeAnalyticsRange(fromDate?: string, toDate?: string) {
  const end = toDate ? parseAnalyticsBoundary(toDate, "end") : new Date()
  const start = fromDate
    ? parseAnalyticsBoundary(fromDate, "start")
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1))

  return {
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
  }
}

function parseAnalyticsBoundary(value: string, boundary: "start" | "end") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"

    return new Date(`${value}${suffix}`)
  }

  const parsed = new Date(value)

  if (boundary === "end") {
    parsed.setUTCHours(23, 59, 59, 999)
  }

  return parsed
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

function buildRoomUtilization(
  rooms: Array<{
    id: string
    room_number: string
    room_type: string
    capacity: number
    base_monthly_fee: number
    status: string
  }>,
  allocations: Array<{ room_id: string; status: string }>
) {
  return rooms.map((room) => {
    const occupied = allocations.filter(
      (allocation) => allocation.room_id === room.id && allocation.status === "active"
    ).length
    const utilizationRate = percent(occupied, room.capacity)

    return {
      roomId: room.id,
      roomNumber: room.room_number,
      roomType: room.room_type,
      capacity: room.capacity,
      occupied,
      available: Math.max(0, room.capacity - occupied),
      utilizationRate,
      revenuePotential: Number((room.base_monthly_fee * room.capacity).toFixed(2)),
      status: room.status,
      underperforming: room.status === "active" && room.capacity > 0 && utilizationRate < 50,
    }
  })
}

function buildMonthlyOwnerBucket(
  month: { key: string; start: string; end: string },
  data: {
    totalBeds: number
    residents: Array<{ created_at: string; joined_on: string | null; checkout_on: string | null }>
    reservations: Array<{ created_at: string; status: string; advance_amount: number }>
    payments: Array<{ amount: number; status: string; created_at: string; verified_at: string | null }>
    feeRecords: Array<{
      period_month: string
      total_amount: number
      paid_amount: number
      balance_amount: number
      status: string
    }>
    allocations: Array<{ allocated_from: string; allocated_to: string | null; status: string }>
  }
) {
  const monthPayments = data.payments.filter(
    (payment) => monthKey(payment.verified_at ?? payment.created_at) === month.key
  )
  const monthFeeRecords = data.feeRecords.filter(
    (record) => monthKey(record.period_month) === month.key
  )
  const monthReservations = data.reservations.filter(
    (reservation) => monthKey(reservation.created_at) === month.key
  )
  const occupied = data.allocations.filter(
    (allocation) =>
      allocation.status === "active" &&
      allocationOverlapsMonth(allocation.allocated_from, allocation.allocated_to, month.start, month.end)
  ).length

  return {
    month: month.key,
    occupancyRate: percent(occupied, data.totalBeds),
    occupiedBeds: occupied,
    revenue: sum(
      monthPayments
        .filter((payment) => payment.status === "verified")
        .map((payment) => payment.amount)
    ),
    billed: sum(monthFeeRecords.map((record) => record.total_amount)),
    dues: sum(monthFeeRecords.map((record) => record.balance_amount)),
    newResidents: data.residents.filter((resident) =>
      monthKey(resident.joined_on ?? resident.created_at) === month.key
    ).length,
    churnedResidents: data.residents.filter((resident) =>
      monthKey(resident.checkout_on ?? "") === month.key
    ).length,
    reservations: monthReservations.length,
    confirmedReservations: monthReservations.filter((reservation) =>
      ["confirmed", "converted_to_resident"].includes(reservation.status)
    ).length,
    reservationAdvance: sum(monthReservations.map((reservation) => reservation.advance_amount)),
    paymentConversion:
      monthPayments.length === 0
        ? 0
        : percent(
            monthPayments.filter((payment) => payment.status === "verified").length,
            monthPayments.length
          ),
  }
}

function buildDuesAging(
  records: Array<{ due_date: string; balance_amount: number }>,
  now: Date
) {
  const buckets = [
    { label: "Current", minDays: Number.NEGATIVE_INFINITY, maxDays: 0, amount: 0, records: 0 },
    { label: "1-30 days", minDays: 1, maxDays: 30, amount: 0, records: 0 },
    { label: "31-60 days", minDays: 31, maxDays: 60, amount: 0, records: 0 },
    { label: "61-90 days", minDays: 61, maxDays: 90, amount: 0, records: 0 },
    { label: "90+ days", minDays: 91, maxDays: Number.POSITIVE_INFINITY, amount: 0, records: 0 },
  ]

  for (const record of records) {
    const age = Math.floor((now.getTime() - new Date(record.due_date).getTime()) / 86_400_000)
    const bucket =
      buckets.find((item) => age >= item.minDays && age <= item.maxDays) ?? buckets[0]

    bucket.amount = Number((bucket.amount + record.balance_amount).toFixed(2))
    bucket.records += 1
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    amount: bucket.amount,
    records: bucket.records,
  }))
}

function buildOwnerRevenueForecast(
  monthly: Array<{ billed: number; revenue: number; dues: number }>
) {
  const recent = monthly.slice(-3)
  const averageBilled = average(recent.map((item) => item.billed))
  const averageRevenue = average(recent.map((item) => item.revenue))
  const collectionRate = average(
    recent.map((item) => (item.billed === 0 ? 0 : item.revenue / item.billed))
  )

  return {
    nextMonthExpectedBilling: Number(averageBilled.toFixed(2)),
    expectedCollectionRate: Number((collectionRate * 100).toFixed(2)),
    expectedCollectedRevenue: Number(averageRevenue.toFixed(2)),
    riskAdjustedPendingDues: Number((sum(recent.map((item) => item.dues)) * 0.35).toFixed(2)),
  }
}

function buildOwnerOccupancyForecast(input: {
  currentOccupied: number
  totalBeds: number
  monthly: Array<{ newResidents: number; churnedResidents: number; confirmedReservations: number }>
  residents: Array<{ checkout_on: string | null }>
  fromDate: string
}) {
  const recent = input.monthly.slice(-3)
  const expectedJoins = Math.round(
    average(recent.map((item) => item.newResidents + item.confirmedReservations))
  )
  const expectedChurn = Math.round(average(recent.map((item) => item.churnedResidents)))
  const next30Days = new Date(input.fromDate)
  next30Days.setUTCDate(next30Days.getUTCDate() + 30)
  const expectedCheckouts = input.residents.filter(
    (resident) =>
      resident.checkout_on &&
      resident.checkout_on >= input.fromDate.slice(0, 10) &&
      resident.checkout_on <= next30Days.toISOString().slice(0, 10)
  ).length
  const forecastOccupied = Math.max(
    0,
    Math.min(input.totalBeds, input.currentOccupied + expectedJoins - expectedChurn - expectedCheckouts)
  )

  return {
    horizonDays: 30,
    expectedJoins,
    expectedChurn: expectedChurn + expectedCheckouts,
    forecastOccupiedBeds: forecastOccupied,
    forecastOccupancyRate: percent(forecastOccupied, input.totalBeds),
    expectedVacancies: Math.max(0, input.totalBeds - forecastOccupied),
  }
}

function buildOwnerInsights(input: {
  availableBeds: number
  totalBeds: number
  occupiedBeds: number
  pendingDues: number
  overdueRecords: number
  unpaidResidents: number
  paymentConversion: number
  onboardingIncomplete: number
  roomUtilization: Array<{
    roomNumber: string
    utilizationRate: number
    underperforming: boolean
  }>
}) {
  const insights: Array<{
    severity: "critical" | "warning" | "info" | "success"
    title: string
    description: string
    action: string
  }> = []
  const occupancyRate = percent(input.occupiedBeds, input.totalBeds)
  const underperformingRooms = input.roomUtilization.filter((room) => room.underperforming)

  if (input.availableBeds <= 5 && input.totalBeds > 0) {
    insights.push({
      severity: "critical",
      title: "Capacity risk",
      description: `${input.availableBeds} student vacancies are available. Admissions should prioritize lead follow-up and room occupancy.`,
      action: "Review vacancy and upcoming students leaving.",
    })
  } else if (occupancyRate < 70 && input.totalBeds > 0) {
    insights.push({
      severity: "warning",
      title: "Occupancy below target",
      description: `Current occupancy is ${occupancyRate}%. Lead follow-up and room pricing may need attention.`,
      action: "Review reservation trends and underused rooms.",
    })
  }

  if (input.overdueRecords > 0 || input.pendingDues > 0) {
    insights.push({
      severity: input.overdueRecords > 0 ? "critical" : "warning",
      title: "Payment collection risk",
      description: `${input.unpaidResidents} residents have unpaid balances. Pending dues need finance follow-up.`,
      action: "Open payments and send reminders.",
    })
  }

  if (input.onboardingIncomplete > 0) {
    insights.push({
      severity: "warning",
      title: "Onboarding bottleneck",
      description: `${input.onboardingIncomplete} residents have not finished onboarding. Operational access may be blocked.`,
      action: "Open onboarding follow-up.",
    })
  }

  if (underperformingRooms.length > 0) {
    insights.push({
      severity: "info",
      title: "Rooms underperforming",
      description: `${underperformingRooms.length} active rooms are below 50% utilization.`,
      action: "Review room allocation and pricing.",
    })
  }

  if (input.paymentConversion < 80 && input.paymentConversion > 0) {
    insights.push({
      severity: "warning",
      title: "Payment conversion needs review",
      description: `Only ${input.paymentConversion}% of submitted payments are verified in the selected range.`,
      action: "Check rejected and pending UPI submissions.",
    })
  }

  if (insights.length === 0) {
    insights.push({
      severity: "success",
      title: "Operations look stable",
      description: "No critical occupancy, dues, onboarding, or room-utilization risks were detected.",
      action: "Keep monitoring weekly trends.",
    })
  }

  return insights
}

function buildOwnerAnalyticsCsv(
  dashboard: Awaited<ReturnType<AnalyticsService["getOwnerDashboard"]>>
) {
  const rows: string[][] = [
    ["Metric", "Value"],
    ["Generated At", dashboard.generatedAt],
    ["Occupancy Rate", `${dashboard.summary.occupancyRate}%`],
    ["Revenue", String(dashboard.summary.revenue)],
    ["Pending Dues", String(dashboard.summary.pendingDues)],
    ["Unpaid Residents", String(dashboard.summary.unpaidResidents)],
    ["Payment Conversion", `${dashboard.summary.paymentConversion}%`],
    ["Resident Churn", `${dashboard.summary.residentChurn}%`],
    ["Average Stay Days", String(dashboard.summary.averageStayDurationDays)],
    [],
    ["Month", "Revenue", "Billed", "Dues", "Occupancy", "Reservations", "New Residents"],
    ...dashboard.trends.map((trend) => [
      trend.month,
      String(trend.revenue),
      String(trend.billed),
      String(trend.dues),
      `${trend.occupancyRate}%`,
      String(trend.reservations),
      String(trend.newResidents),
    ]),
    [],
    ["Insight", "Severity", "Action"],
    ...dashboard.insights.map((insight) => [
      insight.title,
      insight.severity,
      insight.action,
    ]),
  ]

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n")
}

async function buildOwnerAnalyticsPdf(
  dashboard: Awaited<ReturnType<AnalyticsService["getOwnerDashboard"]>>
) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = 790

  page.drawText("Owner Operational Intelligence", {
    x: 48,
    y,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.08, 0.14),
  })
  y -= 28
  page.drawText(`Generated ${dashboard.generatedAt}`, { x: 48, y, size: 9, font })
  y -= 32

  const summary = [
    ["Occupancy", `${dashboard.summary.occupancyRate}%`],
    ["Revenue", `INR ${dashboard.summary.revenue}`],
    ["Pending Dues", `INR ${dashboard.summary.pendingDues}`],
    ["Unpaid Residents", String(dashboard.summary.unpaidResidents)],
    ["Payment Conversion", `${dashboard.summary.paymentConversion}%`],
    ["Expected Vacancies", String(dashboard.forecasts.expectedVacancies)],
  ]

  for (const [label, value] of summary) {
    page.drawText(label, { x: 48, y, size: 10, font })
    page.drawText(value, { x: 260, y, size: 10, font: bold })
    y -= 18
  }

  y -= 20
  page.drawText("Operational Insights", { x: 48, y, size: 13, font: bold })
  y -= 22

  for (const insight of dashboard.insights.slice(0, 8)) {
    page.drawText(`${insight.severity.toUpperCase()} - ${insight.title}`, {
      x: 48,
      y,
      size: 10,
      font: bold,
    })
    y -= 14
    page.drawText(insight.action, { x: 62, y, size: 9, font })
    y -= 18
  }

  y -= 8
  page.drawText("Monthly Trend Snapshot", { x: 48, y, size: 13, font: bold })
  y -= 20

  for (const trend of dashboard.trends.slice(-8)) {
    page.drawText(
      `${trend.month}: Revenue INR ${trend.revenue}, Occupancy ${trend.occupancyRate}%, Dues INR ${trend.dues}`,
      { x: 48, y, size: 9, font }
    )
    y -= 14
  }

  return Buffer.from(await pdf.save())
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function calculateGrowth(values: number[]) {
  const previous = values.at(-2) ?? 0
  const current = values.at(-1) ?? 0

  if (previous === 0) {
    return current > 0 ? 100 : 0
  }

  return Number((((current - previous) / previous) * 100).toFixed(2))
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return Number(((value / total) * 100).toFixed(2))
}

function average(values: number[]) {
  const cleanValues = values.filter((value) => Number.isFinite(value))

  if (cleanValues.length === 0) {
    return 0
  }

  return Number((sum(cleanValues) / cleanValues.length).toFixed(2))
}

function daysBetween(from?: string | null, to?: string | null) {
  if (!from || !to) {
    return 0
  }

  return Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
  )
}

function isDateInRange(value: string | null, fromDate: string, toDate: string) {
  if (!value) {
    return false
  }

  return value >= fromDate.slice(0, 10) && value <= toDate.slice(0, 10)
}

function csvEscape(value: unknown) {
  const normalized = value === undefined || value === null ? "" : String(value)

  if (!/[",\n\r]/.test(normalized)) {
    return normalized
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`
}
