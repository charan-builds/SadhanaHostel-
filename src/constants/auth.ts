import type { Database } from "@/types/database"

export type AppRole = Database["public"]["Enums"]["user_role_enum"]

export const ADMIN_ROUTE_PREFIX = "/admin"
export const RESIDENT_ROUTE_PREFIX = "/resident"

export const ADMIN_ROLES = ["super_admin", "owner", "admin"] satisfies AppRole[]
export const RESIDENT_ROLES = ["resident"] satisfies AppRole[]

export const AUTH_REDIRECTS = {
  login: "/login",
  onboarding: "/onboarding",
  unauthorized: "/unauthorized",
  adminHome: "/admin/dashboard",
  residentHome: "/resident/dashboard",
} as const

export type ProtectedRouteArea = "admin" | "resident"

export type ProtectedRoutePolicy = {
  area: ProtectedRouteArea
  allowedRoles: readonly AppRole[]
  loginPath: string
  unauthorizedPath: string
}

export const PROTECTED_ROUTE_POLICIES = {
  admin: {
    area: "admin",
    allowedRoles: ADMIN_ROLES,
    loginPath: AUTH_REDIRECTS.login,
    unauthorizedPath: AUTH_REDIRECTS.unauthorized,
  },
  resident: {
    area: "resident",
    allowedRoles: RESIDENT_ROLES,
    loginPath: AUTH_REDIRECTS.login,
    unauthorizedPath: AUTH_REDIRECTS.unauthorized,
  },
} as const satisfies Record<ProtectedRouteArea, ProtectedRoutePolicy>
