"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive,
  Bell,
  CheckCheck,
  ClipboardList,
  Clock3,
  Filter,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { APIErrorState } from "@/components/system/api-error-state"
import { EmptyState } from "@/components/system/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useArchiveNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import {
  notificationCategories,
  notificationPriorities,
  type NotificationCategory,
  type NotificationPriority,
} from "@/lib/notifications/catalog"
import { buildNotificationIntelligence } from "@/lib/notifications/intelligence"
import type { NotificationRow } from "@/repositories/notifications.repository"

type CategoryFilter = "all" | NotificationCategory
type PriorityFilter = "all" | NotificationPriority
type ReadFilter = "all" | "unread"

export function AdminNotificationsClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [category, setCategory] = useState<CategoryFilter>("all")
  const [priority, setPriority] = useState<PriorityFilter>("all")
  const [readFilter, setReadFilter] = useState<ReadFilter>("all")
  const notificationsQuery = useNotifications(
    organizationId
      ? {
          organizationId,
          hostelId,
          page: 1,
          pageSize: 50,
          channel: "in_app",
          category: category === "all" ? undefined : category,
          priority: priority === "all" ? undefined : priority,
          unreadOnly: readFilter === "unread",
        }
      : undefined
  )
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const archiveNotification = useArchiveNotification()
  const notifications = useMemo(
    () => notificationsQuery.data?.data ?? [],
    [notificationsQuery.data?.data]
  )
  const intelligence = useMemo(
    () => buildNotificationIntelligence(notifications),
    [notifications]
  )
  const groupedNotifications = useMemo(
    () => groupNotificationsByPriority(notifications),
    [notifications]
  )

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  const activeOrganizationId = organizationId

  async function handleMarkRead(notification: NotificationRow) {
    await markRead.mutateAsync({
      notificationId: notification.id,
      input: { organizationId: activeOrganizationId },
    })
    toast.success("Notification marked read.")
  }

  async function handleMarkAllRead() {
    await markAllRead.mutateAsync({ organizationId: activeOrganizationId, hostelId })
    toast.success("Notifications marked read.")
  }

  async function handleArchive(notification: NotificationRow) {
    await archiveNotification.mutateAsync({
      notificationId: notification.id,
      input: { organizationId: activeOrganizationId },
    })
    toast.success("Notification archived.")
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <NotificationMetric label="Unread" value={intelligence.unread} />
        <NotificationMetric
          label="Read rate"
          value={`${intelligence.readPercentage}%`}
        />
        <NotificationMetric
          label="Needs action"
          value={intelligence.reminderActions.reduce((sum, action) => sum + action.count, 0)}
        />
      </div>

      <Card>
        <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Smart Notification Center</CardTitle>
            <CardDescription>
              Prioritized in-app alerts, read tracking, reminders, and engagement health.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={notificationsQuery.isFetching}
              onClick={() => void notificationsQuery.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button asChild className="gap-2">
              <Link href="/admin/notices">
                <ClipboardList className="size-4" aria-hidden="true" />
                Manage notices
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="size-4" aria-hidden="true" />
                {intelligence.nextAction?.title ?? "Notification flow is healthy"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {intelligence.nextAction?.description ??
                  "No failed deliveries, critical unread items, or stale urgent reminders in this view."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={
                markAllRead.isPending ||
                intelligence.unread === 0 ||
                !organizationId
              }
              onClick={() => void handleMarkAllRead()}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all read
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NotificationInsightCard
              label="Top priority"
              value={humanizeEnum(intelligence.topPriority)}
              detail={`${intelligence.criticalUnread} critical unread`}
            />
            <NotificationInsightCard
              label="Queued"
              value={intelligence.queued}
              detail={`${intelligence.scheduled} scheduled`}
            />
            <NotificationInsightCard
              label="Finance"
              value={intelligence.categories.finance}
              detail="Payment and receipt alerts"
            />
            <NotificationInsightCard
              label="Hostel"
              value={intelligence.categories.hostel}
              detail="Notice and operations alerts"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="size-4" aria-hidden="true" />
              Filters
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <Select value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
                <SelectTrigger className="w-full" aria-label="Filter notifications by category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {notificationCategories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {humanizeEnum(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(value) => setPriority(value as PriorityFilter)}>
                <SelectTrigger className="w-full" aria-label="Filter notifications by priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {notificationPriorities.map((item) => (
                    <SelectItem key={item} value={item}>
                      {humanizeEnum(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={readFilter} onValueChange={(value) => setReadFilter(value as ReadFilter)}>
                <SelectTrigger className="w-full" aria-label="Filter notifications by read status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All read states</SelectItem>
                  <SelectItem value="unread">Unread only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {intelligence.reminderActions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {intelligence.reminderActions.map((action) => (
                <div key={action.id} className="rounded-lg border bg-white/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant={action.severity === "critical" ? "destructive" : "secondary"}>
                        {humanizeEnum(action.severity)}
                      </Badge>
                      <h3 className="mt-2 text-sm font-semibold">{action.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <span className="text-lg font-semibold">{action.count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {notificationsQuery.isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 rounded-lg border bg-muted/50" />
              ))}
            </div>
          ) : notificationsQuery.isError ? (
            <APIErrorState
              title="Notifications could not be loaded"
              error={notificationsQuery.error}
              onRetry={() => void notificationsQuery.refetch()}
            />
          ) : notifications.length === 0 ? (
            <EmptyState
              title="No active notifications"
              message="Payment reminders, notices, support updates, and operational alerts will appear here."
            />
          ) : (
            <div className="grid gap-3">
              {groupedNotifications.map((group) => (
                <section key={group.priority} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold">{humanizeEnum(group.priority)}</h2>
                    <Badge variant="secondary">{group.items.length}</Badge>
                  </div>
                  <div className="grid gap-3">
                    {group.items.map((notification) => (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        isUpdating={markRead.isPending || archiveNotification.isPending}
                        onMarkRead={handleMarkRead}
                        onArchive={handleArchive}
                      />
                    ))}
                  </div>
                </section>
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

function NotificationInsightCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-lg border bg-white/70 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function NotificationCard({
  notification,
  isUpdating,
  onMarkRead,
  onArchive,
}: {
  notification: NotificationRow
  isUpdating: boolean
  onMarkRead: (notification: NotificationRow) => Promise<void>
  onArchive: (notification: NotificationRow) => Promise<void>
}) {
  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={notification.status} />
            <Badge variant={priorityBadgeVariant(notification.priority)}>
              {humanizeEnum(notification.priority)}
            </Badge>
            <Badge variant="secondary">{humanizeEnum(notification.category)}</Badge>
            {!notification.read_at ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Unread
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-semibold">{notification.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Created {formatDateTime(notification.created_at)}
            </span>
            {notification.read_at ? <span>Read {formatDateTime(notification.read_at)}</span> : null}
            {notification.scheduled_for ? (
              <span>Scheduled {formatDateTime(notification.scheduled_for)}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!notification.read_at ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUpdating}
              onClick={() => void onMarkRead(notification)}
            >
              Mark read
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isUpdating}
            onClick={() => void onArchive(notification)}
          >
            <Archive className="size-4" aria-hidden="true" />
            Archive
          </Button>
        </div>
      </div>
    </article>
  )
}

function groupNotificationsByPriority(notifications: readonly NotificationRow[]) {
  return [...notificationPriorities]
    .reverse()
    .map((priority) => ({
      priority,
      items: notifications.filter((notification) => notification.priority === priority),
    }))
    .filter((group) => group.items.length > 0)
}

function priorityBadgeVariant(priority: string) {
  if (priority === "critical" || priority === "urgent") {
    return "destructive" as const
  }

  if (priority === "warning") {
    return "outline" as const
  }

  return "secondary" as const
}
