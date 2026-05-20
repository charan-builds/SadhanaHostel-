import { apiClient } from "@/lib/api-client"
import type { z } from "zod"

import type {
  advancedAnalyticsSchema,
  dashboardAnalyticsSchema,
} from "@/validations/analytics.validation"

export type DashboardAnalyticsInput = z.infer<typeof dashboardAnalyticsSchema>
export type AdvancedAnalyticsInput = z.infer<typeof advancedAnalyticsSchema>

export type DashboardAnalytics = {
  totalResidents: number
  occupancy: {
    occupiedBeds: number
    capacity: number
    occupancyRate: number
  }
  finance: {
    monthlyRevenue: number
    pendingDues: number
  }
  recentPayments: unknown[]
  recentLeaves: unknown[]
  generatedAt: string
}

export type AdvancedAnalytics = {
  range: {
    fromDate: string
    toDate: string
  }
  occupancyTrends: unknown[]
  paymentTrends: unknown[]
  feeTrends: unknown[]
  revenueForecast: {
    nextMonthExpectedBilling: number
    expectedCollectionRate: number
    expectedCollectedRevenue: number
  }
  leaveFrequency: unknown[]
  residentGrowth: unknown[]
  generatedAt: string
}

export const analyticsSdk = {
  dashboard(params: DashboardAnalyticsInput) {
    return apiClient.get<DashboardAnalytics>("/api/v1/analytics/dashboard", params)
  },

  advanced(params: AdvancedAnalyticsInput) {
    return apiClient.get<AdvancedAnalytics>("/api/v1/analytics/advanced", params)
  },
}
