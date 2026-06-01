import "server-only"

import type { Route } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  AUTH_REDIRECTS,
  PROTECTED_ROUTE_POLICIES,
  anyRoleHasPermission,
  type AppRole,
  type PermissionKey,
  type ProtectedRouteArea,
} from "@/constants/auth"
import { toApiError } from "@/lib/api/api-error"
import { AuthService } from "@/services/auth.service"
import { ResidentOnboardingService } from "@/services/onboarding/resident-onboarding.service"

export async function requireProtectedRoute(area: ProtectedRouteArea) {
  const headerStore = await headers()
  const requestedPath =
    headerStore.get("x-sadhana-pathname") ??
    (area === "admin" ? AUTH_REDIRECTS.adminHome : AUTH_REDIRECTS.residentHome)
  const policy = PROTECTED_ROUTE_POLICIES[area]
  const authService = await AuthService.create()
  const context = await getAuthenticatedContext(authService, requestedPath)

  const allowedRoles = policy.allowedRoles as readonly AppRole[]

  if (!context.roles.some((role) => allowedRoles.includes(role))) {
    redirect(policy.unauthorizedPath)
  }

  if (area === "admin") {
    const routeRequiredPermission = getAdminRouteRequiredPermission(requestedPath)

    if (
      routeRequiredPermission &&
      !anyRoleHasPermission(context.roles, routeRequiredPermission)
    ) {
      redirect(policy.unauthorizedPath)
    }
  }

  if (context.organizationId === null) {
    if (area === "admin" && requestedPath.startsWith(AUTH_REDIRECTS.adminSetup)) {
      return context
    }

    redirect(
      (area === "admin"
        ? AUTH_REDIRECTS.adminSetup
        : AUTH_REDIRECTS.onboarding) as Route
    )
  }

  if (
    area === "admin" &&
    context.hostelIds.length === 0 &&
    !requestedPath.startsWith(AUTH_REDIRECTS.adminSetup)
  ) {
    redirect(AUTH_REDIRECTS.adminSetup as Route)
  }

  if (
    area === "resident" &&
    !isResidentOnboardingAllowedPath(requestedPath)
  ) {
    const onboardingService = await ResidentOnboardingService.create()
    let overview: Awaited<ReturnType<ResidentOnboardingService["getCurrentStatus"]>>

    try {
      overview = await onboardingService.getCurrentStatus({
        organizationId: context.organizationId,
      })
    } catch {
      redirect(AUTH_REDIRECTS.residentOnboarding as Route)
    }

    if (!overview.requirements.canAccessResidentOperations) {
      redirect(AUTH_REDIRECTS.residentOnboarding as Route)
    }
  }

  return context
}

function getAdminRouteRequiredPermission(requestedPath: string): PermissionKey | null {
  const pathname = requestedPath.split("?")[0]

  if (
    pathname.startsWith("/admin/settings") ||
    pathname.startsWith("/admin/operations/automation") ||
    pathname.startsWith("/admin/launch-readiness")
  ) {
    return "settings.manage"
  }

  if (
    pathname.startsWith("/admin/finance/payment-security") ||
    pathname.startsWith("/admin/website") ||
    pathname.startsWith("/admin/gallery")
  ) {
    return pathname.startsWith("/admin/finance/payment-security")
      ? "finance.manage"
      : "cms.manage"
  }

  if (pathname.startsWith("/admin/payments")) return "finance.manage"
  if (pathname.startsWith("/admin/reports")) return "reports.export"
  if (pathname.startsWith("/admin/owner-dashboard")) return "analytics.view"

  if (
    pathname.startsWith("/admin/leads") ||
    pathname.startsWith("/admin/reservations") ||
    pathname.startsWith("/admin/vacancy")
  ) {
    return "admissions.manage"
  }

  if (pathname.startsWith("/admin/residents")) return "residents.manage"
  if (pathname.startsWith("/admin/rooms")) return "rooms.manage"
  if (pathname.startsWith("/admin/leaves")) return "leaves.manage"
  if (pathname.startsWith("/admin/notices")) return "notices.manage"

  return null
}

function isResidentOnboardingAllowedPath(requestedPath: string) {
  const pathname = requestedPath.split("?")[0]

  return (
    pathname === AUTH_REDIRECTS.residentOnboarding ||
    pathname.startsWith(`${AUTH_REDIRECTS.residentOnboarding}/`) ||
    pathname === "/resident/support" ||
    pathname.startsWith("/resident/support/")
  )
}

async function getAuthenticatedContext(
  authService: AuthService,
  requestedPath: string
) {
  try {
    return await authService.getCurrentContext()
  } catch (error) {
    const apiError = toApiError(error)

    if (apiError.statusCode === 401) {
      const loginPath = requestedPath.startsWith("/resident")
        ? AUTH_REDIRECTS.residentLogin
        : AUTH_REDIRECTS.adminLogin

      redirect(
        `${loginPath}?next=${encodeURIComponent(requestedPath)}`
      )
    }

    throw error
  }
}
