"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  IndianRupee,
  Megaphone,
  Pin,
  Search,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import {
  useAcknowledgeNotice,
  useCurrentResident,
  useMarkNoticeRead,
  useNotices,
} from "@/hooks"
import { useRealtimeNotifications } from "@/lib/realtime/useRealtimeNotifications"
import type { NoticeWithEngagement } from "@/types/notices"

const PAGE_SIZE = 50

type NoticeFilter = "all" | "unread" | "emergency" | "fee"

const noticeFilters: Array<{ value: NoticeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "emergency", label: "Emergency" },
  { value: "fee", label: "Fee" },
]

export function ResidentNoticesClient() {
  const { organizationId } = useAuth()
  const residentQuery = useCurrentResident(organizationId ?? undefined)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<NoticeFilter>("all")
  const markRead = useMarkNoticeRead()
  const acknowledgeNotice = useAcknowledgeNotice()

  useRealtimeNotifications({
    enabled: Boolean(organizationId && residentQuery.data?.id),
    residentId: residentQuery.data?.id,
  })

  const noticesQuery = useNotices({
    organizationId: organizationId ?? "",
    hostelId: residentQuery.data?.hostel_id,
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    activeOnly: true,
  })

  const notices = useMemo(() => noticesQuery.data?.data ?? [], [noticesQuery.data?.data])
  const filteredNotices = useMemo(
    () => notices.filter((notice) => noticeMatchesFilter(notice, filter)),
    [filter, notices]
  )

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization not linked"
        message="Your account must be assigned to an organization before notices can be shown."
      />
    )
  }

  const meta = noticesQuery.data?.meta
  const unreadCount = notices.filter((notice) => !notice.is_read).length
  const emergencyCount = notices.filter((notice) => notice.notice_type === "emergency").length
  const pendingAcknowledgementCount = notices.filter(
    (notice) => notice.requires_acknowledgement && !notice.is_acknowledged
  ).length

  return (
    <div className="mx-auto grid w-full max-w-md gap-5 lg:max-w-5xl">
      <section className="rounded-2xl border bg-white/85 p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Notice center</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notices</h1>
          </div>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground">
              {unreadCount} unread
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
              All read
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <NoticeMetric label="Unread" value={unreadCount} />
          <NoticeMetric label="Emergency" value={emergencyCount} />
          <NoticeMetric label="Pending" value={pendingAcknowledgementCount} />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="relative">
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
            className="h-11 rounded-xl bg-white/85 pl-9"
            placeholder="Search notices"
            aria-label="Search notices"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {noticeFilters.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "outline"}
              className="h-10 shrink-0 rounded-full"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>

      {noticesQuery.isLoading ? (
        <NoticeSkeleton />
      ) : noticesQuery.isError ? (
        <APIErrorState
          title="Notices could not be loaded"
          error={noticesQuery.error}
          onRetry={() => void noticesQuery.refetch()}
        />
      ) : filteredNotices.length === 0 ? (
        <EmptyState
          title="No notices found"
          message="New hostel announcements will appear here as soon as they are published."
        />
      ) : (
        <section className="grid gap-3">
          {filteredNotices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              organizationId={organizationId}
              isMarkingRead={markRead.isPending}
              isAcknowledging={acknowledgeNotice.isPending}
              onMarkRead={() => {
                void markRead.mutateAsync({
                  noticeId: notice.id,
                  input: { organizationId },
                })
              }}
              onAcknowledge={() => {
                void acknowledgeNotice.mutateAsync({
                  noticeId: notice.id,
                  input: { organizationId },
                })
              }}
            />
          ))}
        </section>
      )}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Showing {filteredNotices.length} of {meta?.total ?? 0}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10"
            disabled={!meta || page <= 1 || noticesQuery.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            className="h-10"
            disabled={!meta || page >= meta.totalPages || noticesQuery.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function NoticeCard({
  notice,
  organizationId,
  isMarkingRead,
  isAcknowledging,
  onMarkRead,
  onAcknowledge,
}: {
  notice: NoticeWithEngagement
  organizationId: string
  isMarkingRead: boolean
  isAcknowledging: boolean
  onMarkRead: () => void
  onAcknowledge: () => void
}) {
  const meta = noticeMeta(notice)
  const Icon = meta.icon

  return (
    <article className="rounded-2xl border bg-white/85 p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ${meta.className}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {notice.is_pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Pin className="size-3" aria-hidden="true" />
                Pinned
              </span>
            ) : null}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {meta.label}
            </span>
            {!notice.is_read ? (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900">
                Unread
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Read
              </span>
            )}
            <StatusBadge status={notice.status} />
          </div>

          <h2 className="mt-3 text-base font-semibold">{notice.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {notice.body}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {notice.published_at ? formatDateTime(notice.published_at) : "Not scheduled"}
          </p>

          {notice.requires_acknowledgement ? (
            notice.is_acknowledged ? (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Acknowledged
              </p>
            ) : (
              <Button
                type="button"
                className="mt-4 h-11 w-full"
                disabled={!organizationId || isAcknowledging}
                onClick={onAcknowledge}
              >
                Acknowledge
              </Button>
            )
          ) : !notice.is_read ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-11 w-full"
              disabled={!organizationId || isMarkingRead}
              onClick={onMarkRead}
            >
              Mark as Read
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function NoticeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function NoticeSkeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-2xl border bg-white/80 p-4">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="mt-4 h-5 w-2/3 rounded bg-muted" />
          <div className="mt-3 h-4 w-full rounded bg-muted" />
          <div className="mt-2 h-4 w-5/6 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function noticeMatchesFilter(notice: NoticeWithEngagement, filter: NoticeFilter) {
  if (filter === "unread") {
    return !notice.is_read
  }

  if (filter === "emergency") {
    return notice.notice_type === "emergency"
  }

  if (filter === "fee") {
    return notice.notice_type === "fee_updates"
  }

  return true
}

function noticeMeta(notice: NoticeWithEngagement): {
  label: string
  icon: LucideIcon
  className: string
} {
  if (notice.notice_type === "emergency") {
    return {
      label: "Emergency Notices",
      icon: AlertTriangle,
      className: "bg-red-50 text-red-700 ring-red-200",
    }
  }

  if (notice.notice_type === "maintenance") {
    return {
      label: "Maintenance Notices",
      icon: Wrench,
      className: "bg-sky-50 text-sky-700 ring-sky-200",
    }
  }

  if (notice.notice_type === "fee_updates") {
    return {
      label: "Fee Updates",
      icon: IndianRupee,
      className: "bg-amber-50 text-amber-800 ring-amber-200",
    }
  }

  return {
    label: humanizeEnum(notice.notice_type) || "Admin Notices",
    icon: notice.notice_type === "general" ? Megaphone : Bell,
    className: "bg-primary/10 text-primary ring-primary/20",
  }
}
