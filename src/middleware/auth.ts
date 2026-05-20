import {
  ADMIN_ROUTE_PREFIX,
  PROTECTED_ROUTE_POLICIES,
  RESIDENT_ROUTE_PREFIX,
  type AppRole,
  type ProtectedRoutePolicy,
} from "@/constants/auth"
import type { Tables } from "@/types/database"

type UserRoleAssignment = Pick<
  Tables<"user_roles">,
  "role" | "organization_id" | "hostel_id" | "status"
>

type UserProfileForAccess = Pick<
  Tables<"users">,
  "default_role" | "organization_id" | "is_active" | "deleted_at"
>

export function getProtectedRoutePolicy(
  pathname: string
): ProtectedRoutePolicy | null {
  if (pathname === ADMIN_ROUTE_PREFIX || pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`)) {
    return PROTECTED_ROUTE_POLICIES.admin
  }

  if (
    pathname === RESIDENT_ROUTE_PREFIX ||
    pathname.startsWith(`${RESIDENT_ROUTE_PREFIX}/`)
  ) {
    return PROTECTED_ROUTE_POLICIES.resident
  }

  return null
}

export function getEffectiveRoles(
  profile: UserProfileForAccess,
  roleAssignments: UserRoleAssignment[]
) {
  const roles = new Set<AppRole>()

  if (profile.is_active && !profile.deleted_at) {
    roles.add(profile.default_role)
  }

  roleAssignments.forEach((assignment) => {
    if (assignment.status === "active") {
      roles.add(assignment.role)
    }
  })

  return [...roles]
}

export function hasAllowedRole(
  roles: readonly AppRole[],
  allowedRoles: readonly AppRole[]
) {
  return roles.some((role) => allowedRoles.includes(role))
}

export function buildAuthRedirect(
  requestUrl: string,
  pathname: string,
  redirectPath: string,
  reason?: string
) {
  const url = new URL(redirectPath, requestUrl)
  url.searchParams.set("next", pathname)

  if (reason) {
    url.searchParams.set("reason", reason)
  }

  return url
}
