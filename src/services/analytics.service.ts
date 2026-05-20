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
import { dashboardAnalyticsSchema } from "@/validations/analytics.validation"

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
}
