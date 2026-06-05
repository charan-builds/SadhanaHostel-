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
  invites: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "resident-invites"] as const
    },
    resident(scope: TenantScope, residentId?: string | null) {
      return [...queryKeys.invites.all(scope), "resident", residentId ?? "none"] as const
    },
  },
  onboarding: {
    me(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "onboarding", "me"] as const
    },
    queue(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.tenant(scope), "onboarding", "queue", filters] as const
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
    settings(scope: TenantScope) {
      return [...queryKeys.payments.all(scope), "settings"] as const
    },
    settingsHistory(scope: TenantScope) {
      return [...queryKeys.payments.all(scope), "settings-history"] as const
    },
    ledger(scope: TenantScope, residentId: string) {
      return [...queryKeys.payments.all(scope), "ledger", residentId] as const
    },
  },
  finance: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "finance"] as const
    },
    dashboard(scope: TenantScope) {
      return [...queryKeys.finance.all(scope), "dashboard"] as const
    },
    followups(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.finance.all(scope), "followups", filters] as const
    },
  },
  platform: {
    setupStatus: ["platform", "setup-status"] as const,
    organization: ["platform", "organization"] as const,
    hostels: ["platform", "hostels"] as const,
  },
  staffAccess: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "staff-access"] as const
    },
    list(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.staffAccess.all(scope), "list", filters] as const
    },
  },
  support: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "support"] as const
    },
    requests(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.support.all(scope), "requests", filters] as const
    },
    alerts(scope: TenantScope) {
      return [...queryKeys.support.all(scope), "alerts"] as const
    },
  },
  operations: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "operations"] as const
    },
    automation(scope: TenantScope) {
      return [...queryKeys.operations.all(scope), "automation"] as const
    },
    consistency(scope: TenantScope) {
      return [...queryKeys.operations.all(scope), "consistency"] as const
    },
    identity(scope: TenantScope) {
      return [...queryKeys.operations.all(scope), "identity"] as const
    },
  },
  launch: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "launch"] as const
    },
    diagnostics(scope: TenantScope) {
      return [...queryKeys.launch.all(scope), "diagnostics"] as const
    },
    metrics(scope: TenantScope) {
      return [...queryKeys.launch.all(scope), "metrics"] as const
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
  notifications: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "notifications"] as const
    },
    list(scope: TenantScope, filters: Record<string, unknown>) {
      return [...queryKeys.notifications.all(scope), "list", filters] as const
    },
  },
  analytics: {
    all(scope: TenantScope) {
      return [...queryKeys.tenant(scope), "analytics"] as const
    },
    dashboard(scope: TenantScope) {
      return [...queryKeys.analytics.all(scope), "dashboard"] as const
    },
    advanced(scope: TenantScope, range: Record<string, unknown>) {
      return [...queryKeys.analytics.all(scope), "advanced", range] as const
    },
    owner(scope: TenantScope, range: Record<string, unknown>) {
      return [...queryKeys.analytics.all(scope), "owner", range] as const
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
