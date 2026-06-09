"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { ChevronDown, Menu } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  adminNavigationItems,
  adminQuickActions,
  type AdminNavigationItem,
} from "@/components/admin/layout/admin-sidebar"
import { BrandMark } from "@/components/shared/brand-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { anyRoleHasPermission } from "@/constants/auth"
import { hostelConfig } from "@/constants/hostel"
import { useOperationalAlerts, useSupportRequests } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const mobileNavigationGroups = [
  {
    title: "Today",
    hrefs: ["/admin/dashboard", "/admin/owner-dashboard", "/admin/alerts", "/admin/password-resets"],
  },
  {
    title: "Residents",
    hrefs: ["/admin/leads", "/admin/reservations", "/admin/residents", "/admin/rooms"],
  },
  {
    title: "Money",
    hrefs: [
      "/admin/finance",
      "/admin/finance/collections",
      "/admin/finance/followups",
      "/admin/finance/receipts",
      "/admin/finance/reconciliation",
      "/admin/payments",
    ],
  },
  {
    title: "Communication",
    hrefs: ["/admin/notices", "/admin/notifications", "/admin/alerts"],
  },
  {
    title: "Operations",
    hrefs: [
      "/admin/operations",
      "/admin/reports",
      "/admin/operations/intelligence",
      "/admin/operations/automation",
      "/admin/launch-readiness",
    ],
  },
  {
    title: "Settings",
    hrefs: [
      "/admin/website",
      "/admin/gallery",
      "/admin/settings/staff-access",
      "/admin/settings/rules",
      "/admin/settings",
    ],
  },
] as const

function flattenNavigationItems(items: AdminNavigationItem[]) {
  return items.flatMap((item) => [item, ...(item.children ?? [])])
}

export function AdminMobileSidebar({ logoUrl }: { logoUrl?: string | null }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const canManageSupport = anyRoleHasPermission(session?.roles ?? [], "residents.manage")
  const passwordResetRequests = useSupportRequests({
    organizationId: canManageSupport ? organizationId ?? "" : "",
    hostelId,
    status: "open",
    category: "account",
    workflow: "resident_password_reset",
    page: 1,
    pageSize: 1,
  })
  const operationalAlerts = useOperationalAlerts({
    organizationId: canManageSupport ? organizationId ?? undefined : undefined,
    hostelId,
  })
  const passwordResetCount = passwordResetRequests.data?.meta.total ?? 0
  const operationalAlertCount = operationalAlerts.data?.length ?? 0
  const urgentCount = passwordResetCount + operationalAlertCount
  const flattenedItems = flattenNavigationItems(adminNavigationItems)
  const groupedItems = mobileNavigationGroups.map((group) => ({
    ...group,
    items: group.hrefs
      .map((href) => flattenedItems.find((item) => item.href === href))
      .filter((item): item is AdminNavigationItem => Boolean(item)),
  }))
  const linkedGroupedHrefs = new Set(groupedItems.flatMap((group) => group.items.map((item) => item.href)))
  const allTools = flattenedItems.filter((item) => !linkedGroupedHrefs.has(item.href))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open admin navigation"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle className="flex items-center gap-3">
            <BrandMark logoUrl={logoUrl} />
            <span>{hostelConfig.shortName}</span>
          </SheetTitle>
          <SheetDescription>Admin task navigation</SheetDescription>
        </SheetHeader>

        <nav className="grid gap-5 px-3 py-4" aria-label="Mobile admin navigation">
          <section className="grid gap-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                Quick actions
              </h2>
              {urgentCount > 0 ? <Badge variant="destructive">{urgentCount} urgent</Badge> : null}
            </div>
            <div className="grid gap-2">
              {adminQuickActions.map((item) => {
                const Icon = item.icon
                const isActive = isActiveRoute(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-all duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      isActive && "border-primary/30 bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="grid gap-3">
            {groupedItems.map((group) => {
              const groupActive = group.items.some((item) => isActiveRoute(pathname, item.href))
              const groupBadge =
                group.title === "Today"
                  ? urgentCount
                  : group.title === "Operations"
                    ? operationalAlertCount
                    : 0

              return (
                <div key={group.title} className="rounded-xl border bg-white/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2
                      className={cn(
                        "text-xs font-semibold uppercase text-muted-foreground",
                        groupActive && "text-primary"
                      )}
                    >
                      {group.title}
                    </h2>
                    {groupBadge > 0 ? <Badge variant="destructive">{groupBadge}</Badge> : null}
                  </div>
                  <div className="mt-2 grid gap-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = isActiveRoute(pathname, item.href)

                      return (
                        <Link
                          key={item.href}
                          href={item.href as Route}
                          onClick={() => setOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                            isActive && "bg-primary/10 text-primary"
                          )}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>

          <details className="rounded-xl border bg-white/60 p-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
              <span>All tools</span>
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            </summary>
            <div className="mt-2 grid gap-1">
              {allTools.map((item) => {
                const Icon = item.icon
                const isActive = isActiveRoute(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          </details>
        </nav>

        <div className="border-t p-4">
          <div className="saas-surface rounded-xl p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{hostelConfig.name}</p>
            <p className="mt-1 leading-5">{hostelConfig.location.note}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
