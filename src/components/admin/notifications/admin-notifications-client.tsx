"use client"

import Link from "next/link"
import { Bell, ClipboardList } from "lucide-react"

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
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { useNotices } from "@/hooks"

export function AdminNotificationsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const noticesQuery = useNotices({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 8,
    activeOnly: true,
  })

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization not linked"
        message="Your admin account must be linked before notifications can be reviewed."
      />
    )
  }

  const notices = noticesQuery.data?.data ?? []

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <NotificationMetric label="Active notices" value={notices.length} />
        <NotificationMetric
          label="Pinned"
          value={notices.filter((notice) => notice.is_pinned).length}
        />
        <NotificationMetric
          label="Published"
          value={notices.filter((notice) => notice.status === "published").length}
        />
      </div>

      <Card>
        <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Resident Notification Feed</CardTitle>
            <CardDescription>
              Current resident-facing announcements that drive in-app notification updates.
            </CardDescription>
          </div>
          <Button asChild className="gap-2">
            <Link href="/admin/notices">
              <ClipboardList className="size-4" aria-hidden="true" />
              Manage notices
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {noticesQuery.isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 rounded-lg border bg-muted/50" />
              ))}
            </div>
          ) : noticesQuery.isError ? (
            <APIErrorState
              title="Notifications could not be loaded"
              error={noticesQuery.error}
              onRetry={() => void noticesQuery.refetch()}
            />
          ) : notices.length === 0 ? (
            <EmptyState
              title="No active notifications"
              message="Published notices and resident alerts will appear here."
            />
          ) : (
            <div className="grid gap-3">
              {notices.map((notice) => (
                <article key={notice.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={notice.status} />
                        {notice.is_pinned ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Pinned
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 font-semibold">{notice.title}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {notice.body}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {notice.published_at
                        ? formatDateTime(notice.published_at)
                        : "Not published"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NotificationMetric({ label, value }: { label: string; value: string | number }) {
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
