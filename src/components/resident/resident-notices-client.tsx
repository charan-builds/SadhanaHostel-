"use client"

import { useState } from "react"
import { Bell, Pin, Search } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { useCurrentResident, useNotices } from "@/hooks"
import { useRealtimeNotifications } from "@/lib/realtime/useRealtimeNotifications"

const PAGE_SIZE = 8

export function ResidentNoticesClient() {
  const { organizationId } = useAuth()
  const residentQuery = useCurrentResident(organizationId ?? undefined)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  useRealtimeNotifications({ enabled: Boolean(organizationId) })

  const noticesQuery = useNotices({
    organizationId: organizationId ?? "",
    hostelId: residentQuery.data?.hostel_id,
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    activeOnly: true,
  })

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization not linked"
        message="Your account must be assigned to an organization before notices can be shown."
      />
    )
  }

  const notices = noticesQuery.data?.data ?? []
  const meta = noticesQuery.data?.meta
  const pinnedCount = notices.filter((notice) => notice.is_pinned).length

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <NoticeMetric label="Visible notices" value={meta?.total ?? 0} />
        <NoticeMetric label="Pinned" value={pinnedCount} />
        <NoticeMetric label="Page" value={`${meta?.page ?? page}/${meta?.totalPages ?? 1}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notices</CardTitle>
          <CardDescription>
            Hostel announcements, payment reminders, leave updates, and policy changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="pl-9"
              placeholder="Search notices"
              aria-label="Search notices"
            />
          </div>

          {noticesQuery.isLoading ? (
            <NoticeSkeleton />
          ) : noticesQuery.isError ? (
            <APIErrorState
              title="Notices could not be loaded"
              error={noticesQuery.error}
              onRetry={() => void noticesQuery.refetch()}
            />
          ) : notices.length === 0 ? (
            <EmptyState
              title="No notices found"
              message="New hostel announcements will appear here as soon as they are published."
            />
          ) : (
            <div className="grid gap-4">
              {notices.map((notice) => (
                <article
                  key={notice.id}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {notice.is_pinned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Pin className="size-3" aria-hidden="true" />
                            Pinned
                          </span>
                        ) : null}
                        <StatusBadge status={notice.status} />
                      </div>
                      <h2 className="mt-3 text-base font-semibold">{notice.title}</h2>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        {notice.body}
                      </p>
                    </div>
                    <div className="shrink-0 text-sm text-muted-foreground">
                      {notice.published_at
                        ? formatDateTime(notice.published_at)
                        : "Not scheduled"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {notices.length} of {meta?.total ?? 0} notices
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!meta || page <= 1 || noticesQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!meta || page >= meta.totalPages || noticesQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function NoticeMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Bell className="size-5" aria-hidden="true" />
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function NoticeSkeleton() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-lg border p-4">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="mt-4 h-5 w-2/3 rounded bg-muted" />
          <div className="mt-3 h-4 w-full rounded bg-muted" />
          <div className="mt-2 h-4 w-5/6 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
