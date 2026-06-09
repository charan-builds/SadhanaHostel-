import "server-only"

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import {
  buildTenantCacheKey,
  getOrSetCache,
} from "@/lib/cache"
import { hostelModules } from "@/config/hostel-modules"
import { escapeCsvCell } from "@/lib/csv"
import { normalizeDateBoundary } from "@/lib/date-range"
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
    const fromDate = dashboard.range.fromDate.slice(0, 10)
    const toDate = dashboard.range.toDate.slice(0, 10)
    const scope = values.hostelId ? `-${values.hostelId.slice(0, 8)}` : ""
    const fileName = `owner-dashboard${scope}-${fromDate}-to-${toDate}.${values.format}`

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
    const billingEligibleResidentIds = new Set(
      residentLifecycleRows
        .filter(isResidentEligibleForBilling)
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
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

    return {
      totalResidents: residentLifecycle.registeredResidents,
      residentLifecycle,
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
    const [
      payments,
      rawFeeRecords,
      leaves,
      residentGrowthRows,
      residentLifecycleRows,
    ] =
      await Promise.all([
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
        this.analyticsRepository.listResidentLifecycleRows(organizationId, hostelId),
      ])
    const operationalResidents = residentLifecycleRows.filter(
      isResidentEligibleForAnalytics
    )
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
        (payment) => monthKey(payment.created_at) === month.key
      )
      const verified = payments.filter(
        (payment) =>
          payment.status === "verified" &&
          payment.verified_at &&
          monthKey(payment.verified_at) === month.key
      )

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
      const created = residentGrowthRows.filter(
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
    const periodEnd = new Date(toDate)
    const yearStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), 0, 1)).toISOString()
    const [
      residents,
      reservations,
      payments,
      feeRecords,
      rooms,
      allocations,
      supportRequests,
      noticeNotifications,
      revenueScopePayments,
      advanceBalances,
      advanceRefunds,
      leads,
    ] = await Promise.all([
      this.analyticsRepository.listOwnerResidents(organizationId, hostelId),
      this.analyticsRepository.listOwnerReservations(organizationId, fromDate, toDate, hostelId),
      this.analyticsRepository.listPaymentsInRange(organizationId, fromDate, toDate, hostelId),
      this.analyticsRepository.listOwnerFeeRecords(organizationId, fromDate, toDate, hostelId),
      this.analyticsRepository.listOwnerRooms(organizationId, hostelId),
      this.analyticsRepository.listRoomAllocationsInRange(
        organizationId,
        fromDate,
        toDate,
        hostelId
      ),
      this.analyticsRepository.listOwnerSupportRequests(
        organizationId,
        fromDate,
        toDate,
        hostelId
      ),
      this.analyticsRepository.listOwnerNoticeNotifications(
        organizationId,
        fromDate,
        toDate,
        hostelId
      ),
      this.analyticsRepository.listPaymentsForRevenueScope(
        organizationId,
        yearStart,
        toDate,
        hostelId
      ),
      this.analyticsRepository.listOwnerAdvanceBalances(organizationId, hostelId),
      this.analyticsRepository.listOwnerAdvanceRefunds(organizationId, hostelId),
      this.analyticsRepository.countOwnerLeads(organizationId, fromDate, toDate, hostelId),
    ])

    const operationalResidents = residents.filter((resident) =>
      wasResidentOperationalAtPeriodEnd(resident, toDate)
    )
    const residentsInPeriod = residents.filter((resident) =>
      isDateInRange(resident.joined_on ?? resident.created_at, fromDate, toDate)
    )
    const billingEligibleResidentIds = new Set(
      residents
        .filter((resident) =>
          wasResidentBillableInPeriod(resident, fromDate, toDate)
        )
        .map((resident) => resident.id)
        .filter((residentId): residentId is string => Boolean(residentId))
    )
    const billingFeeRecords = feeRecords.filter((record) =>
      billingEligibleResidentIds.has(record.resident_id)
    )
    const verifiedPayments = payments.filter(
      (payment) =>
        payment.status === "verified" &&
        payment.verified_at &&
        payment.verified_at >= fromDate &&
        payment.verified_at <= toDate
    )
    const pendingFeeRecords = billingFeeRecords.filter((record) =>
      ["pending", "partial", "overdue"].includes(record.status)
    )
    const unpaidResidentIds = new Set(
      pendingFeeRecords
        .filter((record) => Number(record.balance_amount) > 0)
        .map((record) => record.resident_id)
    )
    const overdueRecords = pendingFeeRecords.filter(
      (record) => record.due_date < toDate.slice(0, 10)
    )
    const completedOnboarding = residentsInPeriod.filter(
      (resident) => resident.onboarding_status === "verified"
    ).length
    const checkedOutInRange = residents.filter((resident) =>
      isDateInRange(resident.checkout_on, fromDate, toDate)
    ).length
    const joinedResidents = operationalResidents.filter((resident) => resident.joined_on)
    const monthly = months.map((month) =>
      buildMonthlyOwnerBucket(month, {
        residents,
        reservations,
        payments,
        feeRecords: billingFeeRecords,
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
    const advanceLiability = hostelModules.startupFinanceZero
      ? 0
      : sum(advanceBalances.map((row) => Number(row.remaining_advance_balance ?? 0)))
    const refundLiability = hostelModules.startupFinanceZero
      ? 0
      : sum(
          advanceRefunds
            .filter((refund) => ["requested", "approved"].includes(refund.status))
            .map((refund) => refund.amount)
        )
    const revenue = hostelModules.startupFinanceZero
      ? 0
      : sum(verifiedPayments.map((payment) => payment.amount))
    const billed = hostelModules.startupFinanceZero
      ? 0
      : sum(billingFeeRecords.map((record) => record.total_amount))
    const pendingDues = hostelModules.startupFinanceZero
      ? 0
      : sum(pendingFeeRecords.map((record) => record.balance_amount))
    const paidAmount = hostelModules.startupFinanceZero
      ? 0
      : sum(billingFeeRecords.map((record) => record.paid_amount))
    const overdueAmount = hostelModules.startupFinanceZero
      ? 0
      : sum(overdueRecords.map((record) => record.balance_amount))
    const paymentConversion =
      hostelModules.startupFinanceZero || payments.length === 0
        ? 0
        : Number(((verifiedPayments.length / payments.length) * 100).toFixed(2))
    const averageStayDurationDays = average(
      joinedResidents.map((resident) =>
        daysBetween(
          resident.joined_on,
          resident.checkout_on ?? toDate.slice(0, 10)
        )
      )
    )
    const revenueForecast = buildOwnerRevenueForecast(financeMonthly)
    const occupancyRate = calculateAverageOccupancy(
      rooms,
      allocations,
      fromDate,
      toDate
    )
    const activeRooms = rooms.filter((room) => room.status === "active")
    const totalBeds = sum(activeRooms.map((room) => room.capacity))
    const periodEndDate = toDate.slice(0, 10)
    const occupiedBeds = new Set(
      allocations
        .filter((allocation) =>
          allocation.status === "active" &&
          allocation.allocated_from <= periodEndDate &&
          (!allocation.allocated_to || allocation.allocated_to >= periodEndDate)
        )
        .map((allocation) => allocation.resident_id)
    ).size
    const vacantBeds = Math.max(0, totalBeds - occupiedBeds)
    const dailyRevenue = hostelModules.startupFinanceZero
      ? 0
      : sum(
          revenueScopePayments
            .filter((payment) => payment.verified_at?.slice(0, 10) === periodEndDate)
            .map((payment) => payment.amount)
        )
    const monthlyRevenue = hostelModules.startupFinanceZero
      ? 0
      : sum(
          revenueScopePayments
            .filter((payment) => payment.verified_at?.slice(0, 7) === periodEndDate.slice(0, 7))
            .map((payment) => payment.amount)
        )
    const yearlyRevenue = hostelModules.startupFinanceZero
      ? 0
      : sum(revenueScopePayments.map((payment) => payment.amount))
    const noticeReadCount = noticeNotifications.filter(
      (notification) =>
        Boolean(notification.read_at) &&
        (notification.read_at ?? "") <= toDate
    ).length
    const noticeEngagement = percent(noticeReadCount, noticeNotifications.length)
    const admissions = residentsInPeriod.length
    const complaints = supportRequests.length
    const insights = buildOwnerInsights({
      pendingDues,
      overdueRecords: hostelModules.startupFinanceZero ? 0 : overdueRecords.length,
      unpaidResidents: hostelModules.startupFinanceZero ? 0 : unpaidResidentIds.size,
      onboardingIncomplete: Math.max(
        0,
        residentsInPeriod.length - completedOnboarding
      ),
      paymentConversion,
    })

    return {
      range: { fromDate, toDate },
      summary: {
        revenue,
        dailyRevenue,
        monthlyRevenue,
        yearlyRevenue,
        billed,
        pendingDues,
        overdueAmount,
        expectedCollection: billed,
        actualCollection: revenue,
        collectionEfficiency: percent(revenue, billed),
        collectionRate: percent(paidAmount, billed),
        occupancyRate,
        occupiedBeds,
        vacantBeds,
        occupancyPercent: percent(occupiedBeds, totalBeds),
        outstandingDues: pendingDues,
        advanceLiability,
        refundLiability,
        leads,
        admissions,
        conversionRate: percent(admissions, leads),
        complaints,
        noticeEngagement,
        unpaidResidents: hostelModules.startupFinanceZero ? 0 : unpaidResidentIds.size,
        totalResidents: residents.length,
        activeResidents: operationalResidents.length,
        billingResidents: billingEligibleResidentIds.size,
        monthlyGrowth: calculateGrowth(financeMonthly.map((item) => item.newResidents)),
        paymentConversion,
        residentChurn: percent(checkedOutInRange, Math.max(residents.length, 1)),
        averageStayDurationDays,
      },
      onboarding: {
        totalResidents: residentsInPeriod.length,
        completed: completedOnboarding,
        completionRate: percent(completedOnboarding, residentsInPeriod.length),
        pending: countBy(residentsInPeriod, (resident) =>
          String(resident.onboarding_status ?? "unknown")
        ),
      },
      duesAging: hostelModules.startupFinanceZero
        ? []
        : buildDuesAging(pendingFeeRecords, periodEnd),
      trends: financeMonthly.map((trend) => ({
        ...trend,
        collectionEfficiency: percent(trend.revenue, trend.billed),
        advanceLiability,
        occupancyRate,
      })),
      forecasts: {
        revenue: revenueForecast,
      },
      insights,
      hasData:
        operationalResidents.length > 0 ||
        admissions > 0 ||
        reservations.length > 0 ||
        payments.length > 0 ||
        billingFeeRecords.length > 0 ||
        supportRequests.length > 0 ||
        noticeNotifications.length > 0,
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
  return new Date(normalizeDateBoundary(value, boundary))
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

function buildMonthlyOwnerBucket(
  month: { key: string; start: string; end: string },
  data: {
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
  }
) {
  const monthPayments = data.payments.filter(
    (payment) => monthKey(payment.created_at) === month.key
  )
  const monthVerifiedPayments = data.payments.filter(
    (payment) =>
      payment.status === "verified" &&
      payment.verified_at &&
      monthKey(payment.verified_at) === month.key
  )
  const monthFeeRecords = data.feeRecords.filter(
    (record) => monthKey(record.period_month) === month.key
  )
  const monthReservations = data.reservations.filter(
    (reservation) => monthKey(reservation.created_at) === month.key
  )
  return {
    month: month.key,
    revenue: sum(
      monthVerifiedPayments.map((payment) => payment.amount)
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

function buildOwnerInsights(input: {
  pendingDues: number
  overdueRecords: number
  unpaidResidents: number
  paymentConversion: number
  onboardingIncomplete: number
}) {
  const insights: Array<{
    severity: "critical" | "warning" | "info" | "success"
    title: string
    description: string
    action: string
  }> = []
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
      description: "No critical dues, onboarding, or payment risks were detected.",
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
    ["Period From", dashboard.range.fromDate.slice(0, 10)],
    ["Period To", dashboard.range.toDate.slice(0, 10)],
    ["Generated At", dashboard.generatedAt],
    ["Total Residents", String(dashboard.summary.totalResidents)],
    ["Active Residents", String(dashboard.summary.activeResidents)],
    ["Billing Residents", String(dashboard.summary.billingResidents)],
    ["Daily Revenue", String(dashboard.summary.dailyRevenue)],
    ["Monthly Revenue", String(dashboard.summary.monthlyRevenue)],
    ["Yearly Revenue", String(dashboard.summary.yearlyRevenue)],
    ["Revenue", String(dashboard.summary.revenue)],
    ["Billed", String(dashboard.summary.billed)],
    ["Expected Collection", String(dashboard.summary.expectedCollection)],
    ["Actual Collection", String(dashboard.summary.actualCollection)],
    ["Collection Efficiency", `${dashboard.summary.collectionEfficiency}%`],
    ["Pending Dues", String(dashboard.summary.pendingDues)],
    ["Overdue Amount", String(dashboard.summary.overdueAmount)],
    ["Advance Liability", String(dashboard.summary.advanceLiability)],
    ["Refund Liability", String(dashboard.summary.refundLiability)],
    ["Collection Rate", `${dashboard.summary.collectionRate}%`],
    ["Average Occupancy", `${dashboard.summary.occupancyRate}%`],
    ["Occupied Beds", String(dashboard.summary.occupiedBeds)],
    ["Vacant Beds", String(dashboard.summary.vacantBeds)],
    ["Occupancy %", `${dashboard.summary.occupancyPercent}%`],
    ["Leads", String(dashboard.summary.leads)],
    ["Admissions", String(dashboard.summary.admissions)],
    ["Conversion %", `${dashboard.summary.conversionRate}%`],
    ["Complaints", String(dashboard.summary.complaints)],
    ["Notice Engagement", `${dashboard.summary.noticeEngagement}%`],
    ["Unpaid Residents", String(dashboard.summary.unpaidResidents)],
    ["Payment Conversion", `${dashboard.summary.paymentConversion}%`],
    ["Resident Churn", `${dashboard.summary.residentChurn}%`],
    ["Average Stay Days", String(dashboard.summary.averageStayDurationDays)],
    [],
    ["Month", "Revenue", "Billed", "Dues", "Reservations", "New Residents"],
    ...dashboard.trends.map((trend) => [
      trend.month,
      String(trend.revenue),
      String(trend.billed),
      String(trend.dues),
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
  y -= 14
  page.drawText(
    `Period ${dashboard.range.fromDate.slice(0, 10)} to ${dashboard.range.toDate.slice(0, 10)}`,
    { x: 48, y, size: 9, font }
  )
  y -= 32

  const summary = [
    ["Total Residents", String(dashboard.summary.totalResidents)],
    ["Active Residents", String(dashboard.summary.activeResidents)],
    ["Billing Residents", String(dashboard.summary.billingResidents)],
    ["Daily Revenue", `INR ${dashboard.summary.dailyRevenue}`],
    ["Monthly Revenue", `INR ${dashboard.summary.monthlyRevenue}`],
    ["Yearly Revenue", `INR ${dashboard.summary.yearlyRevenue}`],
    ["Revenue", `INR ${dashboard.summary.revenue}`],
    ["Billed", `INR ${dashboard.summary.billed}`],
    ["Expected Collection", `INR ${dashboard.summary.expectedCollection}`],
    ["Actual Collection", `INR ${dashboard.summary.actualCollection}`],
    ["Collection Efficiency", `${dashboard.summary.collectionEfficiency}%`],
    ["Pending Dues", `INR ${dashboard.summary.pendingDues}`],
    ["Overdue Amount", `INR ${dashboard.summary.overdueAmount}`],
    ["Advance Liability", `INR ${dashboard.summary.advanceLiability}`],
    ["Refund Liability", `INR ${dashboard.summary.refundLiability}`],
    ["Collection Rate", `${dashboard.summary.collectionRate}%`],
    ["Average Occupancy", `${dashboard.summary.occupancyRate}%`],
    ["Occupied Beds", String(dashboard.summary.occupiedBeds)],
    ["Vacant Beds", String(dashboard.summary.vacantBeds)],
    ["Leads", String(dashboard.summary.leads)],
    ["Admissions", String(dashboard.summary.admissions)],
    ["Complaints", String(dashboard.summary.complaints)],
    ["Notice Engagement", `${dashboard.summary.noticeEngagement}%`],
    ["Unpaid Residents", String(dashboard.summary.unpaidResidents)],
    ["Payment Conversion", `${dashboard.summary.paymentConversion}%`],
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
      `${trend.month}: Revenue INR ${trend.revenue}, Billed INR ${trend.billed}, Dues INR ${trend.dues}`,
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

function wasResidentOperationalAtPeriodEnd(
  resident: {
    created_at: string
    joined_on: string | null
    checkout_on: string | null
    onboarding_status: string | null
    user_id: string | null
  },
  toDate: string
) {
  const periodEnd = toDate.slice(0, 10)
  const enteredOn = (resident.joined_on ?? resident.created_at).slice(0, 10)

  return (
    enteredOn <= periodEnd &&
    (!resident.checkout_on || resident.checkout_on > periodEnd) &&
    resident.onboarding_status === "verified" &&
    Boolean(resident.user_id)
  )
}

function wasResidentBillableInPeriod(
  resident: {
    created_at: string
    joined_on: string | null
    checkout_on: string | null
    onboarding_status: string | null
    user_id: string | null
  },
  fromDate: string,
  toDate: string
) {
  const periodStart = fromDate.slice(0, 10)
  const periodEnd = toDate.slice(0, 10)
  const enteredOn = (resident.joined_on ?? resident.created_at).slice(0, 10)

  return (
    enteredOn <= periodEnd &&
    (!resident.checkout_on || resident.checkout_on >= periodStart) &&
    resident.onboarding_status !== "rejected" &&
    resident.onboarding_status !== "suspended" &&
    Boolean(resident.user_id)
  )
}

function calculateAverageOccupancy(
  rooms: Array<{ capacity: number; status: string }>,
  allocations: Array<{
    allocated_from: string
    allocated_to: string | null
    status: string
  }>,
  fromDate: string,
  toDate: string
) {
  const capacity = sum(
    rooms
      .filter((room) => room.status === "active")
      .map((room) => room.capacity)
  )

  if (capacity <= 0) {
    return 0
  }

  const rangeStart = utcDay(fromDate)
  const rangeEnd = utcDay(toDate)
  const rangeDays = inclusiveDays(rangeStart, rangeEnd)
  const occupiedBedDays = allocations
    .filter((allocation) => allocation.status !== "cancelled")
    .reduce((total, allocation) => {
      const allocationStart = Math.max(
        rangeStart,
        utcDay(allocation.allocated_from)
      )
      const allocationEnd = Math.min(
        rangeEnd,
        allocation.allocated_to ? utcDay(allocation.allocated_to) : rangeEnd
      )

      return total + inclusiveDays(allocationStart, allocationEnd)
    }, 0)

  return Math.min(100, percent(occupiedBedDays, capacity * rangeDays))
}

function utcDay(value: string) {
  const date = new Date(value)

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function inclusiveDays(from: number, to: number) {
  if (to < from) {
    return 0
  }

  return Math.floor((to - from) / 86_400_000) + 1
}

function csvEscape(value: unknown) {
  return escapeCsvCell(value)
}
