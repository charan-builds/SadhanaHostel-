"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useOrganizationSettings, useSearch } from "@/hooks"
import { formatDateTime } from "@/lib/format"
import { resolveTenantFeatureFlags } from "@/lib/tenant/feature-flags"
import { cn } from "@/lib/utils"
import { getSearchResultHref, getSearchResultLabel } from "@/lib/search/routes"
import type { SearchInput } from "@/sdk"
import { searchEntityTypes } from "@/validations/search.validation"

type AdminGlobalSearchProps = {
  organizationId?: string | null
  hostelId?: string | null
  className?: string
}

export function AdminGlobalSearch({
  organizationId,
  hostelId,
  className,
}: AdminGlobalSearchProps) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const trimmedQuery = query.trim()
  const organizationQuery = useOrganizationSettings(Boolean(organizationId))
  const featureFlags = useMemo(
    () => resolveTenantFeatureFlags(organizationQuery.data?.settings),
    [organizationQuery.data?.settings]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [trimmedQuery])

  const searchParams = useMemo<SearchInput | undefined>(() => {
    if (!organizationId || debouncedQuery.length < 2) {
      return undefined
    }

    return {
      organizationId,
      hostelId: hostelId ?? undefined,
      query: debouncedQuery,
      types: [...searchEntityTypes],
      page: 1,
      pageSize: 8,
    }
  }, [debouncedQuery, hostelId, organizationId])
  const results = useSearch(searchParams)
  const rows = results.data?.data ?? []
  const showPanel = trimmedQuery.length > 0

  if (!featureFlags.globalSearch) {
    return null
  }

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || rows.length === 0) {
            return
          }

          event.preventDefault()
          window.location.href = getSearchResultHref(rows[0])
        }}
        placeholder="Search residents, rooms, payments, notices..."
        className="h-10 max-w-md bg-white/70 pl-8"
        aria-label="Search residents, rooms, payments, notices, complaints, and reports"
        aria-controls="admin-global-search-results"
        aria-expanded={showPanel}
        autoComplete="off"
      />

      {showPanel ? (
        <div
          id="admin-global-search-results"
          className="absolute left-0 top-full z-40 mt-2 w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-white/70 bg-popover/95 p-2 text-sm shadow-lifted backdrop-blur-xl"
          role="region"
          aria-live="polite"
        >
          {trimmedQuery.length < 2 ? (
            <SearchPanelMessage message="Type at least 2 characters to search the workspace." />
          ) : results.isLoading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : results.isError ? (
            <SearchPanelMessage message="Search is unavailable. Try again in a moment." />
          ) : rows.length === 0 ? (
            <SearchPanelMessage message="No matches found across residents, rooms, payments, notices, complaints, or reports." />
          ) : (
            <div className="grid gap-1">
              {rows.map((result) => (
                <Link
                  key={`${result.entity_type}-${result.entity_id}`}
                  href={getSearchResultHref(result)}
                  className="rounded-lg p-3 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  onClick={() => setQuery("")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{getSearchResultLabel(result.entity_type)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(result.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-medium">{result.title}</p>
                      {result.subtitle ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {result.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-primary">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function SearchPanelMessage({ message }: { message: string }) {
  return <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{message}</p>
}
