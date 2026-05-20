import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { logError } from "@/lib/logger"
import type { Database } from "@/types/database"

export type AppSupabaseClient = SupabaseClient<Database>

export type PaginationParams = {
  page?: number
  pageSize?: number
}

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

export class RepositoryError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(message: string, code = "DATABASE_ERROR", details?: unknown) {
    super(message)
    this.name = "RepositoryError"
    this.code = code
    this.details = details
  }
}

export function normalizePagination(params: PaginationParams = {}) {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to }
}

export function createPaginationMeta(
  count: number | null,
  page: number,
  pageSize: number
): PaginationMeta {
  const total = count ?? 0

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export function throwRepositoryError(
  error: PostgrestError | null,
  fallbackMessage = "Database operation failed."
): never {
  const repositoryError = new RepositoryError(
    error?.message ?? fallbackMessage,
    error?.code,
    error
  )

  logError(repositoryError, {
    event: "repository.error",
    code: repositoryError.code,
    fallbackMessage,
  })

  throw repositoryError
}

export function sanitizeSearchTerm(search?: string | null) {
  const normalized = search?.trim()

  if (!normalized) {
    return null
  }

  return normalized.replace(/[(),]/g, " ").replace(/\s+/g, " ")
}
