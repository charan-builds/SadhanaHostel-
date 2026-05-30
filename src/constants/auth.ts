import type { Database } from "@/types/database"

export type AppRole = Database["public"]["Enums"]["user_role_enum"]

export const ADMIN_ROUTE_PREFIX = "/admin"
export const RESIDENT_ROUTE_PREFIX = "/resident"

export const ADMIN_ROLES = ["super_admin", "owner", "admin"] satisfies AppRole[]
export const FINANCE_ROLES = ["super_admin", "owner", "admin", "finance"] satisfies AppRole[]
export const OPERATIONS_ROLES = [
  "super_admin",
  "owner",
  "admin",
  "receptionist",
  "warden",
  "staff",
] satisfies AppRole[]
export const ADMIN_PORTAL_ROLES = [
  "super_admin",
  "owner",
  "admin",
  "finance",
  "receptionist",
  "warden",
  "staff",
] satisfies AppRole[]
export const RESIDENT_ROLES = ["resident"] satisfies AppRole[]

export type PermissionKey =
  | "admin.dashboard.view"
  | "admissions.manage"
  | "analytics.view"
  | "cms.manage"
  | "finance.manage"
  | "iam.manage"
  | "leaves.manage"
  | "notices.manage"
  | "payments.verify"
  | "reports.export"
  | "residents.manage"
  | "rooms.manage"
  | "settings.manage"

export const ROLE_PERMISSIONS = {
  super_admin: [
    "admin.dashboard.view",
    "admissions.manage",
    "analytics.view",
    "cms.manage",
    "finance.manage",
    "iam.manage",
    "leaves.manage",
    "notices.manage",
    "payments.verify",
    "reports.export",
    "residents.manage",
    "rooms.manage",
    "settings.manage",
  ],
  owner: [
    "admin.dashboard.view",
    "admissions.manage",
    "analytics.view",
    "cms.manage",
    "finance.manage",
    "iam.manage",
    "leaves.manage",
    "notices.manage",
    "payments.verify",
    "reports.export",
    "residents.manage",
    "rooms.manage",
    "settings.manage",
  ],
  admin: [
    "admin.dashboard.view",
    "admissions.manage",
    "analytics.view",
    "cms.manage",
    "finance.manage",
    "iam.manage",
    "leaves.manage",
    "notices.manage",
    "payments.verify",
    "reports.export",
    "residents.manage",
    "rooms.manage",
    "settings.manage",
  ],
  finance: [
    "admin.dashboard.view",
    "analytics.view",
    "finance.manage",
    "payments.verify",
    "reports.export",
  ],
  receptionist: [
    "admin.dashboard.view",
    "admissions.manage",
    "notices.manage",
    "residents.manage",
  ],
  warden: [
    "admin.dashboard.view",
    "leaves.manage",
    "notices.manage",
    "residents.manage",
    "rooms.manage",
  ],
  staff: ["admin.dashboard.view", "notices.manage", "residents.manage"],
  resident: [],
  parent: [],
} satisfies Record<AppRole, PermissionKey[]>

export const ALL_APP_ROLES = Object.keys(ROLE_PERMISSIONS) as AppRole[]

export const ROLE_CAPABILITY_MATRIX = ROLE_PERMISSIONS

export function roleHasPermission(
  role: AppRole,
  permission: PermissionKey
) {
  return (ROLE_PERMISSIONS[role] as readonly PermissionKey[]).includes(permission)
}

export function anyRoleHasPermission(
  roles: readonly AppRole[],
  permission: PermissionKey
) {
  return roles.some((role) => roleHasPermission(role, permission))
}

export function rolesForPermission(permission: PermissionKey) {
  return ALL_APP_ROLES.filter((role) => roleHasPermission(role, permission))
}

export const AUTH_REDIRECTS = {
  login: "/login",
  onboarding: "/onboarding",
  unauthorized: "/unauthorized",
  adminSetup: "/admin/setup",
  adminHome: "/admin/dashboard",
  residentOnboarding: "/resident/onboarding",
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
    allowedRoles: ADMIN_PORTAL_ROLES,
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
