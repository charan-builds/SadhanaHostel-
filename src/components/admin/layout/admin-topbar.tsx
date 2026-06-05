"use client"

import { useMemo, useState } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, LogOut, Search } from "lucide-react"
import { toast } from "sonner"

import { AdminMobileSidebar } from "@/components/admin/layout/admin-mobile-sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { authSdk } from "@/sdk"

export function AdminTopbar({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter()
  const { organizationId, session, refreshSession } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const hostelId = session?.hostelIds[0]
  const notifications = useNotifications(
    organizationId
      ? {
          organizationId,
          hostelId,
          page: 1,
          pageSize: 20,
          channel: "in_app",
        }
      : undefined
  )
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const profile = session?.profile
  const displayName = profile?.full_name ?? session?.user?.email ?? "Admin"
  const displayEmail = profile?.email ?? session?.user?.email ?? "Signed in"
  const roleLabel = session?.primaryRole ? humanizeEnum(session.primaryRole) : "Admin"
  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "A",
    [displayName]
  )
  const notificationRows = notifications.data?.data ?? []
  const unreadCount = notificationRows.filter((notification) => !notification.read_at).length

  async function logout() {
    setIsLoggingOut(true)

    try {
      await authSdk.logout()
      await refreshSession()
      router.replace("/admin/login" as Route)
    } catch {
      toast.error("Logout failed. Please try again.")
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/78 shadow-sm shadow-slate-950/5 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <AdminMobileSidebar logoUrl={logoUrl} />

        <div className="relative hidden min-w-0 flex-1 md:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search residents, payments, notices..."
            className="h-10 max-w-md bg-white/70 pl-8"
            aria-label="Search admin workspace"
            readOnly
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-3 px-2"
                aria-label="Open admin profile menu"
              >
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-medium leading-4">{displayName}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {displayEmail}
                  </span>
                </span>
                <Badge variant="secondary" className="hidden md:inline-flex">
                  {roleLabel}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block text-sm text-foreground">{displayName}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {displayEmail}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isLoggingOut} onClick={() => void logout()}>
                <LogOut className="size-4" aria-hidden="true" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Payments, invoices, receipts, reminders, and operational events.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex items-center justify-between gap-3">
            <Badge variant="secondary">{unreadCount} unread</Badge>
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
              notificationRows.map((notification) => (
                <article
                  key={notification.id}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.read_at ? (
                          <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
                        ) : null}
                        <h3 className="text-sm font-semibold">{notification.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read_at && organizationId ? (
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
                  </div>
                </article>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
