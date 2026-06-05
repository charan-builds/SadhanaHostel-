export type ProductionSafetyMode = "local" | "staging" | "soft_launch" | "production"

export type ProductionSafetySnapshot = {
  launchMode: ProductionSafetyMode | null
  publicLaunchMode: ProductionSafetyMode | null
  effectiveMode: ProductionSafetyMode
  production: boolean
}

const launchModes = new Set<ProductionSafetyMode>([
  "local",
  "staging",
  "soft_launch",
  "production",
])

export function getProductionSafetySnapshot(
  env: Partial<
    Record<"LAUNCH_MODE" | "NEXT_PUBLIC_LAUNCH_MODE" | "NODE_ENV", string>
  > = process.env
): ProductionSafetySnapshot {
  const launchMode = parseSafetyMode(env.LAUNCH_MODE)
  const publicLaunchMode = parseSafetyMode(env.NEXT_PUBLIC_LAUNCH_MODE)
  const effectiveMode =
    launchMode ??
    publicLaunchMode ??
    (env.NODE_ENV === "production" ? "production" : "local")

  return {
    launchMode,
    publicLaunchMode,
    effectiveMode,
    production:
      launchMode === "production" ||
      publicLaunchMode === "production" ||
      effectiveMode === "production",
  }
}

export function isProductionSafetyMode(
  env: Partial<
    Record<"LAUNCH_MODE" | "NEXT_PUBLIC_LAUNCH_MODE" | "NODE_ENV", string>
  > = process.env
) {
  return getProductionSafetySnapshot(env).production
}

function parseSafetyMode(value: string | undefined) {
  const normalized = value?.trim()

  return normalized && launchModes.has(normalized as ProductionSafetyMode)
    ? (normalized as ProductionSafetyMode)
    : null
}
