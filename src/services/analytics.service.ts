import "server-only"

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

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
  ownerAnalyticsExportSchema,
  ownerAnalyticsSchema,
} from "@/validations/analytics.validation"

import { AuthService } from "./auth.service"

const DASHBOARD_CACHE_TTL_MS = 30_000
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

  async getOwnerDashboard(input: unknown) {
    const values = ownerAnalyticsSchema.parse(input)
    const context = await this.authService.requireRole([...ADMIN_ROLES, "finance"])

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const range = normalizeAnalyticsRange(values.fromDate, values.toDate)
    const cacheKey = buildTenantCacheKey({
      organizationId: values.organizationId,
      hostelId: values.hostelId,
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
              hostelId: values.hostelId,
            },
          },
          () =>
            this.loadOwnerDashboard(
              values.organizationId,
              range.fromDate,
              range.toDate,
              values.hostelId
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
    const activeAllocations = allocations.filter((allocation) => allocation.status === "active")
    const totalBeds =
      capacitySnapshot?.total_beds ??
      activeRooms.reduce((total, room) => total + room.capacity, 0)
    const occupiedBeds =
      capacitySnapshot?.occupied_beds ?? activeAllocations.length
    const reservedBeds =
      capacitySnapshot?.reserved_beds ??
      reservations
        .filter((reservation) => ["reserved", "confirmed"].includes(reservation.status))
        .reduce((total, reservation) => total + reservation.reserved_bed_count, 0)
    const maintenanceBlockedBeds = capacitySnapshot?.maintenance_blocked_beds ?? 0
    const availableBeds = Math.max(
      0,
      capacitySnapshot?.available_beds ??
        totalBeds - occupiedBeds - reservedBeds - maintenanceBlockedBeds
    )
    const verifiedPayments = payments.filter((payment) => payment.status === "verified")
    const pendingFeeRecords = feeRecords.filter((record) =>
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
    const completedOnboarding = residents.filter(
      (resident) => resident.onboarding_status === "verified" || resident.status === "active"
    ).length
    const checkedOutInRange = residents.filter((resident) =>
      isDateInRange(resident.checkout_on, fromDate, toDate)
    ).length
    const joinedResidents = residents.filter((resident) => resident.joined_on)
    const roomUtilization = buildRoomUtilization(activeRooms, activeAllocations)
    const monthly = months.map((month) =>
      buildMonthlyOwnerBucket(month, {
        totalBeds,
        residents,
        reservations,
        payments,
        feeRecords,
        allocations,
      })
    )
    const revenue = sum(verifiedPayments.map((payment) => payment.amount))
    const billed = sum(feeRecords.map((record) => record.total_amount))
    const pendingDues = sum(pendingFeeRecords.map((record) => record.balance_amount))
    const paymentConversion =
      payments.length === 0
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
    const revenueForecast = buildOwnerRevenueForecast(monthly)
    const occupancyForecast = buildOwnerOccupancyForecast({
      currentOccupied: occupiedBeds,
      totalBeds,
      monthly,
      residents,
      fromDate: now.toISOString(),
    })
    const insights = buildOwnerInsights({
      availableBeds,
      totalBeds,
      occupiedBeds,
      pendingDues,
      overdueRecords: overdueRecords.length,
      unpaidResidents: unpaidResidentIds.size,
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
        unpaidResidents: unpaidResidentIds.size,
        monthlyGrowth: calculateGrowth(monthly.map((item) => item.newResidents)),
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
      duesAging: buildDuesAging(pendingFeeRecords, now),
      trends: monthly,
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
      description: `${input.availableBeds} beds are available. Admissions should prioritize reservation expiry and waitlist handling.`,
      action: "Review vacancy and upcoming checkouts.",
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
      description: `${input.onboardingIncomplete} residents are not fully verified. Operational access may be blocked.`,
      action: "Review the verification queue.",
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
