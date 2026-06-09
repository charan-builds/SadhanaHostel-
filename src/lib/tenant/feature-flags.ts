export const tenantFeatureFlagKeys = [
  "globalSearch",
  "notificationIntelligence",
  "operationsCenter",
  "ownerDashboardV3",
  "visitorManagement",
  "gatePass",
  "aiOperations",
  "publicAdmissions",
] as const

export type TenantFeatureFlag = (typeof tenantFeatureFlagKeys)[number]
export type TenantFeatureFlags = Record<TenantFeatureFlag, boolean>

export const defaultTenantFeatureFlags: TenantFeatureFlags = {
  globalSearch: true,
  notificationIntelligence: true,
  operationsCenter: true,
  ownerDashboardV3: true,
  visitorManagement: true,
  gatePass: true,
  aiOperations: true,
  publicAdmissions: true,
}

export function resolveTenantFeatureFlags(settings: unknown): TenantFeatureFlags {
  const flags = { ...defaultTenantFeatureFlags }
  const source = readFeatureFlagSource(settings)

  for (const key of tenantFeatureFlagKeys) {
    const value = source[key]
    if (typeof value === "boolean") {
      flags[key] = value
    }
  }

  return flags
}

export function isTenantFeatureEnabled(settings: unknown, flag: TenantFeatureFlag) {
  return resolveTenantFeatureFlags(settings)[flag]
}

function readFeatureFlagSource(settings: unknown) {
  const record = asRecord(settings)
  const featureFlags = asRecord(record.featureFlags)
  const legacyFeatures = asRecord(record.features)

  return {
    ...legacyFeatures,
    ...featureFlags,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
