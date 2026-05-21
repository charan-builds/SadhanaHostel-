import type { QueryKey } from "@tanstack/react-query"

type TenantScope = {
  organizationId?: string | null
  hostelId?: string | null
}

export const queryKeys = {
  auth: {
    session: ["auth", "session"] as const,
  },
  tenant(scope: TenantScope) {
    return ["tenant", scope.organizationId ?? "none", scope.hostelId ?? "global"] as const
  },
  residents: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "residents"] as const
    },
    list(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.residents.all(scope), "list", filters] as const
    },
    detail(scope: TenantScope, residentId: string) {
      return [...queryKeys.residents.all(scope), "detail", residentId] as const
    },
  },
  rooms: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "rooms"] as const
    },
    list(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.rooms.all(scope), "list", filters] as const
    },
    detail(scope: TenantScope, roomId: string) {
      return [...queryKeys.rooms.all(scope), "detail", roomId] as const
    },
  },
  admissions: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "admissions"] as const
    },
    vacancy(scope: TenantScope) {
      return [...queryKeys.admissions.all(scope), "vacancy"] as const
    },
    leads(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.admissions.all(scope), "leads", filters] as const
    },
    reservations(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.admissions.all(scope), "reservations", filters] as const
    },
    analytics(scope: TenantScope) {
      return [...queryKeys.admissions.all(scope), "analytics"] as const
    },
  },
  payments: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "payments"] as const
    },
    list(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.payments.all(scope), "list", filters] as const
    },
    detail(scope: TenantScope, paymentId: string) {
      return [...queryKeys.payments.all(scope), "detail", paymentId] as const
    },
  },
  leaves: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "leaves"] as const
    },
    list(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.leaves.all(scope), "list", filters] as const
    },
  },
  notices: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "notices"] as const
    },
    list(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.notices.all(scope), "list", filters] as const
    },
  },
  analytics: {
    dashboard(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "analytics", "dashboard"] as const
    },
    advanced(scope: TenantScope, range: Record<string, unknown>) {
      return [...queryKeys.tenant(scope), "analytics", "advanced", range] as const
    },
  },
  website: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "website"] as const
    },
    settings(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.website.all(scope), "settings", filters] as const
    },
    facilities(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.website.all(scope), "facilities", filters] as const
    },
    gallery(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.website.all(scope), "gallery", filters] as const
    },
  },
  search(scope: TenantScope, filters: Record<string, unknown>) {
    return [...queryKeys.tenant(scope), "search", filters] as const
  },
}

export function isTenantQueryKey(queryKey: QueryKey, organizationId: string) {
  return queryKey[0] === "tenant" && queryKey[1] === organizationId
}
