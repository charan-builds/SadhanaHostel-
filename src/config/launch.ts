const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

export type LaunchFeatureFlag =
  | "owner_analytics"
  | "resident_onboarding"
  | "manual_upi_payments"
  | "admissions"
  | "automation"
  | "support_center"
  | "staff_access"
  | "cms"

export type LaunchMode = "local" | "staging" | "soft_launch" | "production"

export const KNOWN_LAUNCH_FLAGS: LaunchFeatureFlag[] = [
  "owner_analytics",
  "resident_onboarding",
  "manual_upi_payments",
  "admissions",
  "automation",
  "support_center",
  "staff_access",
  "cms",
]

export function getLaunchMode(): LaunchMode {
  const value = process.env.LAUNCH_MODE ?? process.env.NEXT_PUBLIC_LAUNCH_MODE

  if (value === "staging" || value === "soft_launch" || value === "production") {
    return value
  }

  return process.env.NODE_ENV === "production" ? "production" : "local"
}

export function isMaintenanceModeEnabled() {
  return isTruthy(process.env.MAINTENANCE_MODE ?? process.env.NEXT_PUBLIC_MAINTENANCE_MODE)
}

export function getMaintenanceMessage() {
  return (
    process.env.MAINTENANCE_MESSAGE?.trim() ||
    "Sadhana Boys Hostel is temporarily unavailable while the operations team completes maintenance."
  )
}

export function isMaintenanceBypassRequest(request: Request) {
  const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN?.trim()

  if (!bypassToken) {
    return false
  }

  const url = new URL(request.url)
  const queryToken = url.searchParams.get("maintenance_bypass")
  const headerToken = request.headers.get("x-maintenance-bypass")

  return queryToken === bypassToken || headerToken === bypassToken
}

export function isMaintenanceExemptPath(pathname: string) {
  return (
    pathname === "/maintenance" ||
    pathname.startsWith("/api/health/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  )
}

export function getEnabledFeatureFlags() {
  const explicitFlags = parseFlags(process.env.FEATURE_FLAGS)
  const publicFlags = parseFlags(process.env.NEXT_PUBLIC_FEATURE_FLAGS)

  return new Set<LaunchFeatureFlag>([
    ...KNOWN_LAUNCH_FLAGS.filter((flag) => {
      const envName = `FEATURE_${flag.toUpperCase()}_ENABLED`
      const publicEnvName = `NEXT_PUBLIC_FEATURE_${flag.toUpperCase()}_ENABLED`
      const envValue = process.env[envName] ?? process.env[publicEnvName]

      return envValue === undefined ? false : isTruthy(envValue)
    }),
    ...explicitFlags,
    ...publicFlags,
  ])
}

export function isFeatureEnabled(flag: LaunchFeatureFlag) {
  const enabled = getEnabledFeatureFlags()

  return enabled.has(flag)
}

export function getSoftLaunchResidentLimit() {
  const value = Number(process.env.SOFT_LAUNCH_RESIDENT_LIMIT ?? 20)

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 20
}

export function getLaunchConfigSnapshot() {
  const enabledFlags = [...getEnabledFeatureFlags()]

  return {
    mode: getLaunchMode(),
    maintenance: {
      enabled: isMaintenanceModeEnabled(),
      message: getMaintenanceMessage(),
      bypassConfigured: Boolean(process.env.MAINTENANCE_BYPASS_TOKEN?.trim()),
    },
    featureFlags: {
      enabled: enabledFlags,
      disabled: KNOWN_LAUNCH_FLAGS.filter((flag) => !enabledFlags.includes(flag)),
    },
    softLaunch: {
      residentLimit: getSoftLaunchResidentLimit(),
      supportWhatsAppConfigured: Boolean(process.env.LAUNCH_SUPPORT_WHATSAPP?.trim()),
      ownerEmailConfigured: Boolean(process.env.LAUNCH_OWNER_EMAIL?.trim()),
    },
  }
}

function parseFlags(value?: string) {
  if (!value) {
    return [] as LaunchFeatureFlag[]
  }

  return value
    .split(",")
    .map((flag) => flag.trim())
    .filter((flag): flag is LaunchFeatureFlag =>
      KNOWN_LAUNCH_FLAGS.includes(flag as LaunchFeatureFlag)
    )
}

function isTruthy(value?: string | null) {
  return value ? TRUE_VALUES.has(value.toLowerCase()) : false
}
