import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  AUTH_REDIRECTS,
  PROTECTED_ROUTE_POLICIES,
  type AppRole,
  type ProtectedRouteArea,
} from "@/constants/auth"
import { toApiError } from "@/lib/api/api-error"
import { AuthService } from "@/services/auth.service"

export async function requireProtectedRoute(area: ProtectedRouteArea) {
  const headerStore = await headers()
  const requestedPath =
    headerStore.get("x-sadhana-pathname") ??
    (area === "admin" ? AUTH_REDIRECTS.adminHome : AUTH_REDIRECTS.residentHome)
  const policy = PROTECTED_ROUTE_POLICIES[area]
  const authService = await AuthService.create()
  const context = await getAuthenticatedContext(authService, requestedPath)

  if (context.organizationId === null) {
    redirect(AUTH_REDIRECTS.onboarding)
  }

  const allowedRoles = policy.allowedRoles as readonly AppRole[]

  if (!context.roles.some((role) => allowedRoles.includes(role))) {
    redirect(policy.unauthorizedPath)
  }

  return context
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
      redirect(
        `${AUTH_REDIRECTS.login}?next=${encodeURIComponent(requestedPath)}`
      )
    }

    throw error
  }
}
