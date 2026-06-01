import type { Tables } from "@/types/database"

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type PaginatedResult<T> = {
  data: T[]
  meta: PaginationMeta
}

export type SessionOverview = {
  authenticated: boolean
  user: {
    id: string
    email?: string
  } | null
  profile: Tables<"users"> | null
  roles: Array<Tables<"user_roles">["role"]>
  primaryRole: Tables<"user_roles">["role"] | null
  organizationId: string | null
  hostelIds: string[]
  onboardingRequired: boolean
  redirectTo: string
  security: {
    forcePasswordReset: boolean
    temporaryPasswordActive: boolean
    temporaryPasswordExpiresAt: string | null
  }
}

export type UploadProgress = {
  loaded: number
  total: number
  percent: number
}

export type SearchResult = {
  entity_type: "residents" | "payments" | "rooms" | "notices"
  entity_id: string
  title: string
  subtitle: string | null
  rank: number
  created_at: string
}
