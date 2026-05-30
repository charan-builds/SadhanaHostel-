import {
  FrontendApiError,
  apiClient,
  getCurrentAccessToken,
  notifyApiAuthFailure,
  type ApiResponse,
} from "@/lib/api-client"
import { buildApiUrl, createRequestId } from "@/lib/api-client/request-builder"
import type { z } from "zod"

import type {
  advancedAnalyticsSchema,
  dashboardAnalyticsSchema,
  ownerAnalyticsExportSchema,
  ownerAnalyticsSchema,
} from "@/validations/analytics.validation"

export type DashboardAnalyticsInput = z.infer<typeof dashboardAnalyticsSchema>
export type AdvancedAnalyticsInput = z.infer<typeof advancedAnalyticsSchema>
export type OwnerAnalyticsInput = z.infer<typeof ownerAnalyticsSchema>
export type OwnerAnalyticsExportInput = z.infer<typeof ownerAnalyticsExportSchema>

export type DashboardAnalytics = {
  totalResidents: number
  residentLifecycle: {
    registeredResidents: number
    activeResidents: number
    draftResidents: number
    onboardingResidents: number
    verifiedResidents: number
    suspendedResidents: number
    checkedOutResidents: number
    archivedResidents: number
    pendingVerification: number
  }
  occupancy: {
    occupiedBeds: number
    capacity: number
    vacantBeds: number
    occupancyRate: number
  }
  finance: {
    monthlyRevenue: number
    pendingDues: number
    pendingPayments: number
  }
  operations: {
    activeLeaves: number
    newAdmissions: number
    pendingInvites: number
    pendingVerification: number
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

export type OwnerAnalytics = {
  range: {
    fromDate: string
    toDate: string
  }
  summary: {
    occupancyRate: number
    revenue: number
    billed: number
    pendingDues: number
    unpaidResidents: number
    monthlyGrowth: number
    paymentConversion: number
    residentChurn: number
    averageStayDurationDays: number
  }
  capacity: {
    totalBeds: number
    occupiedBeds: number
    reservedBeds: number
    maintenanceBlockedBeds: number
    availableBeds: number
    lastCalculatedAt: string | null
  }
  onboarding: {
    totalResidents: number
    completed: number
    completionRate: number
    pending: Record<string, number>
  }
  duesAging: Array<{
    label: string
    amount: number
    records: number
  }>
  trends: Array<{
    month: string
    occupancyRate: number
    occupiedBeds: number
    revenue: number
    billed: number
    dues: number
    newResidents: number
    churnedResidents: number
    reservations: number
    confirmedReservations: number
    reservationAdvance: number
    paymentConversion: number
  }>
  roomUtilization: Array<{
    roomId: string
    roomNumber: string
    roomType: string
    capacity: number
    occupied: number
    available: number
    utilizationRate: number
    revenuePotential: number
    status: string
    underperforming: boolean
  }>
  forecasts: {
    occupancy: {
      horizonDays: number
      expectedJoins: number
      expectedChurn: number
      forecastOccupiedBeds: number
      forecastOccupancyRate: number
      expectedVacancies: number
    }
    revenue: {
      nextMonthExpectedBilling: number
      expectedCollectionRate: number
      expectedCollectedRevenue: number
      riskAdjustedPendingDues: number
    }
    expectedVacancies: number
  }
  insights: Array<{
    severity: "critical" | "warning" | "info" | "success"
    title: string
    description: string
    action: string
  }>
  generatedAt: string
}

export type OwnerAnalyticsDownload = {
  blob: Blob
  fileName: string
  contentType: string
}

export const analyticsSdk = {
  dashboard(params: DashboardAnalyticsInput) {
    return apiClient.get<DashboardAnalytics>("/api/v1/analytics/dashboard", params)
  },

  advanced(params: AdvancedAnalyticsInput) {
    return apiClient.get<AdvancedAnalytics>("/api/v1/analytics/advanced", params)
  },

  owner(params: OwnerAnalyticsInput) {
    return apiClient.get<OwnerAnalytics>("/api/v1/analytics/owner", params)
  },

  async downloadOwner(params: OwnerAnalyticsExportInput): Promise<OwnerAnalyticsDownload> {
    const token = await getCurrentAccessToken()
    const requestId = createRequestId()
    const path = "/api/v1/analytics/owner/export"
    const headers = new Headers({
      accept: params.format === "pdf" ? "application/pdf" : "text/csv",
      "x-request-id": requestId,
    })

    if (token) {
      headers.set("authorization", `Bearer ${token}`)
    }

    const response = await fetch(buildApiUrl(path, params), {
      method: "GET",
      credentials: "include",
      headers,
    })

    if (!response.ok) {
      const error = await downloadError(response, requestId)
      notifyApiAuthFailure(path, error)
      throw error
    }

    return {
      blob: await response.blob(),
      fileName: getFileName(
        response.headers.get("content-disposition"),
        params.format ?? "csv"
      ),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    }
  },
}

async function downloadError(response: Response, requestId: string) {
  const payload = await readApiErrorPayload(response)

  return new FrontendApiError({
    code: payload?.error.code ?? `HTTP_${response.status}`,
    message:
      payload?.error.message ??
      `Owner analytics export failed. Status ${response.status}.`,
    status: response.status,
    requestId: payload?.error.requestId ?? response.headers.get("x-request-id") ?? requestId,
    details: payload?.error.details,
  })
}

async function readApiErrorPayload(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return null
  }

  try {
    const payload = (await response.json()) as ApiResponse<unknown>

    return payload.success === false ? payload : null
  } catch {
    return null
  }
}

function getFileName(contentDisposition: string | null, format: "csv" | "pdf") {
  const match = contentDisposition?.match(/filename="([^"]+)"/)

  return match?.[1] ?? `owner-dashboard.${format}`
}
