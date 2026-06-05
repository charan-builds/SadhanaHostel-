export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? ""

export const analyticsConfig = {
  gaMeasurementId: GA_MEASUREMENT_ID,
  isGoogleAnalyticsEnabled: GA_MEASUREMENT_ID.startsWith("G-"),
} as const
