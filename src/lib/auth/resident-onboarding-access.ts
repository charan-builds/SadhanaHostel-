import { AUTH_REDIRECTS } from "@/constants/auth"

const RESIDENT_LIMITED_ACCESS_PATHS = [
  AUTH_REDIRECTS.residentOnboarding,
  "/resident/payments",
  "/resident/support",
] as const

export function isResidentLimitedAccessPath(requestedPath: string) {
  const pathname = requestedPath.split("?")[0]

  return RESIDENT_LIMITED_ACCESS_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}
