"use client"

import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  Bell,
  BellOff,
  CheckCheck,
  CreditCard,
  FileText,
  Loader2,
  LogOut,
  Smartphone,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  useArchiveNotification,
  useCurrentResident,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useWebPushSubscription,
} from "@/hooks"
import { authSdk } from "@/sdk"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import type { NotificationCategory, NotificationPriority } from "@/lib/notifications/catalog"
import { clearPwaTenantState } from "@/lib/pwa/client"
import { useRealtimeNotifications } from "@/lib/realtime"
import type { Json } from "@/types/database"

const notificationCategoryOptions: Array<{ value: NotificationCategory; label: string }> = [
  { value: "finance", label: "Finance" },
  { value: "hostel", label: "Hostel" },
  { value: "personal", label: "Personal" },
]

const priorityTone: Record<NotificationPriority, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  urgent: "border-orange-200 bg-orange-50 text-orange-900",
  critical: "border-red-200 bg-red-50 text-red-900",
}

export function DashboardUserActions({ area }: { area: "admin" | "resident" }) {
  const router = useRouter()
  const { organizationId, refreshSession, session } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | "all">("all")
  const hostelId = session?.hostelIds[0]
  const resident = useCurrentResident(area === "resident" ? organizationId ?? undefined : undefined)
  const notifications = useNotifications(
    notificationsOpen && organizationId
      ? {
          organizationId,
          hostelId,
          page: 1,
          pageSize: 50,
          channel: "in_app",
          category: categoryFilter === "all" ? undefined : categoryFilter,
        }
      : undefined
  )
  const unreadNotifications = useNotifications(
    organizationId
      ? {
          organizationId,
          hostelId,
          page: 1,
          pageSize: 1,
          channel: "in_app",
          unreadOnly: true,
        }
      : undefined
  )
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const archiveNotification = useArchiveNotification()
  const webPush = useWebPushSubscription({
    organizationId,
    hostelId,
    enabled: area === "resident",
  })
  const notificationRows = notifications.data?.data ?? []
  const unreadCount = unreadNotifications.data?.meta.total ?? 0

  useRealtimeNotifications({
    enabled: area === "resident" && Boolean(organizationId && resident.data?.id),
    residentId: resident.data?.id,
  })

  useEffect(() => {
    if (area !== "resident") {
      return
    }

    function openResidentNotifications() {
      setNotificationsOpen(true)
    }

    window.addEventListener("open-resident-notifications", openResidentNotifications)

    return () => {
      window.removeEventListener("open-resident-notifications", openResidentNotifications)
    }
  }, [area])

  async function logout() {
    setIsLoggingOut(true)

    try {
      await authSdk.logout()
      await clearPwaTenantState()
      await refreshSession()
      router.replace((area === "admin" ? "/admin/login" : "/resident/login") as Route)
    } catch {
      toast.error("Logout failed. Please try again.")
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative"
        aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        onClick={() => setNotificationsOpen(true)}
      >
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="justify-start gap-2"
        disabled={isLoggingOut}
        onClick={() => void logout()}
      >
        {isLoggingOut ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="size-4" aria-hidden="true" />
        )}
        Logout
      </Button>
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Fee reminders, overdue alerts, notices, and payment confirmations.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="secondary">{unreadCount} unread</Badge>
            <div className="flex flex-wrap gap-2">
              {area === "resident" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!webPush.isSupported || webPush.isBusy}
                  onClick={() =>
                    webPush.isSubscribed
                      ? void webPush.unsubscribe()
                      : void webPush.subscribe()
                  }
                >
                  {webPush.isSubscribed ? (
                    <BellOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Smartphone className="size-4" aria-hidden="true" />
                  )}
                  {webPush.isSubscribed ? "Disable Push" : "Enable Push"}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!organizationId || markAllRead.isPending || unreadCount === 0}
                onClick={() => {
                  if (!organizationId) {
                    return
                  }

                  void markAllRead.mutateAsync({ organizationId, hostelId }).then(() => {
                    toast.success("All notifications marked read.")
                  })
                }}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                Mark All Read
              </Button>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Button
              type="button"
              size="sm"
              variant={categoryFilter === "all" ? "default" : "outline"}
              onClick={() => setCategoryFilter("all")}
            >
              All
            </Button>
            {notificationCategoryOptions.map((category) => (
              <Button
                key={category.value}
                type="button"
                size="sm"
                variant={categoryFilter === category.value ? "default" : "outline"}
                onClick={() => setCategoryFilter(category.value)}
              >
                {category.label}
              </Button>
            ))}
          </div>
          <div className="mt-5 grid gap-3">
            {notifications.isLoading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-20 rounded-lg border bg-muted/50" />
                ))}
              </div>
            ) : notificationRows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              notificationRows.map((notification) => {
                const action = primaryNotificationAction(notification)

                return (
                <article key={notification.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.read_at ? (
                          <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
                        ) : null}
                        <Badge variant="secondary">{categoryLabel(notification.category)}</Badge>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityTone[notification.priority as NotificationPriority] ?? priorityTone.info}`}>
                          {priorityLabel(notification.priority)}
                        </span>
                        <h3 className="text-sm font-semibold">{notification.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(notification.created_at)}
                      </p>
                    </div>
                    {organizationId ? (
                      <div className="grid shrink-0 gap-2 sm:min-w-32">
                        {action ? (
                          <Button asChild type="button" size="sm">
                            <Link href={action.href as Route}>
                              <action.icon className="size-4" aria-hidden="true" />
                              {action.label}
                            </Link>
                          </Button>
                        ) : null}
                        {!notification.read_at ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={markRead.isPending}
                            onClick={() => {
                              void markRead.mutateAsync({
                                notificationId: notification.id,
                                input: { organizationId },
                              })
                            }}
                          >
                            Mark Read
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={archiveNotification.isPending}
                          onClick={() => {
                            void archiveNotification
                              .mutateAsync({
                                notificationId: notification.id,
                                input: { organizationId },
                              })
                              .then(() => toast.success("Notification archived."))
                          }}
                        >
                          <Archive className="size-4" aria-hidden="true" />
                          Archive
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function primaryNotificationAction(notification: {
  template_key: string | null
  notice_id: string | null
  payload: Json
}) {
  const payload = recordFromJson(notification.payload)
  const noticeId = notification.notice_id ?? stringValue(payload.notice_id)
  const invoiceId = stringValue(payload.invoice_id)

  if (noticeId) {
    return {
      label: "Open Notice",
      href: `/resident/notices?noticeId=${noticeId}`,
      icon: FileText,
    }
  }

  if (invoiceId) {
    return {
      label: "View Invoice",
      href: `/resident/payments?invoiceId=${invoiceId}`,
      icon: FileText,
    }
  }

  if (
    notification.template_key?.startsWith("payment_due") ||
    notification.template_key === "payment_overdue" ||
    notification.template_key === "payment_reminder"
  ) {
    return {
      label: "Pay Now",
      href: "/resident/payments",
      icon: CreditCard,
    }
  }

  return null
}

function recordFromJson(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null
}

function categoryLabel(category: string) {
  return category === "finance" ? "Finance" : category === "hostel" ? "Hostel" : "Personal"
}

function priorityLabel(priority: string) {
  return priority === "critical"
    ? "Critical"
    : priority === "urgent"
      ? "Urgent"
      : priority === "warning"
        ? "Warning"
        : "Info"
}
