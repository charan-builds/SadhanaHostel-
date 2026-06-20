"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  CreditCard,
  GalleryHorizontalEnd,
  Gauge,
  Globe,
  History,
  IndianRupee,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Plus,
  ReceiptText,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  Users,
  WalletCards,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BrandMark } from "@/components/shared/brand-mark"
import { Button } from "@/components/ui/button"
import { hostelModules } from "@/config/hostel-modules"
import { hostelConfig } from "@/constants/hostel"
import { useOperationalAlerts, useSupportRequests } from "@/hooks"
import { useAuth } from "@/lib/auth"
import { humanizeEnum } from "@/lib/format"
import { cn } from "@/lib/utils"

export type AdminNavigationItem = {
  title: string
  href: string
  icon: LucideIcon
  children?: Array<{
    title: string
    href: string
    icon: LucideIcon
  }>
}

export const adminNavigationItems: AdminNavigationItem[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Owner Dashboard", href: "/admin/owner-dashboard", icon: BarChart3 },
  { title: "Leads", href: "/admin/leads", icon: UserRoundPlus },
  {
    title: "Residents",
    href: "/admin/residents",
    icon: Users,
    children: [
      { title: "Directory", href: "/admin/residents", icon: Users },
      { title: "Lifecycle", href: "/admin/residents/lifecycle", icon: Workflow },
    ],
  },
  {
    title: "Finance",
    href: "/admin/finance",
    icon: IndianRupee,
    children: [
      { title: "Dashboard", href: "/admin/finance", icon: Gauge },
      { title: "Advance Ledger", href: "/admin/finance/advance-ledger", icon: WalletCards },
      { title: "Collections", href: "/admin/finance/collections", icon: ClipboardCheck },
      { title: "Followups", href: "/admin/finance/followups", icon: History },
      { title: "Receipts", href: "/admin/finance/receipts", icon: ReceiptText },
      { title: "Reconciliation", href: "/admin/finance/reconciliation", icon: RefreshCcw },
      { title: "Payment Security", href: "/admin/finance/payment-security", icon: ShieldCheck },
    ],
  },
  { title: "Payments", href: "/admin/payments", icon: CreditCard },
  { title: "Leaves", href: "/admin/leaves", icon: CalendarDays },
  { title: "Notices", href: "/admin/notices", icon: ClipboardList },
  { title: "Website CMS", href: "/admin/website", icon: Globe },
  { title: "Gallery", href: "/admin/gallery", icon: GalleryHorizontalEnd },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Alerts", href: "/admin/alerts", icon: LifeBuoy },
  { title: "Password Resets", href: "/admin/password-resets", icon: KeyRound },
  ...(hostelModules.launchReadiness
    ? [{ title: "Launch Readiness", href: "/admin/launch-readiness", icon: ClipboardCheck }]
    : []),
  { title: "Automation", href: "/admin/operations/automation", icon: Bot },
  { title: "WhatsApp", href: "/admin/whatsapp-automation", icon: MessageCircle },
  { title: "Staff & Access", href: "/admin/settings/staff-access", icon: KeyRound },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const quickActions = [
  { title: "Add resident", href: "/admin/residents/new", icon: Plus },
  { title: "Record payment", href: "/admin/payments", icon: CreditCard },
  { title: "Publish notice", href: "/admin/notices", icon: Megaphone },
] satisfies AdminNavigationItem[]

export function AdminSidebar({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname()
  const { organizationId, session } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const hostelId = session?.hostelIds[0]
  const profile = session?.profile
  const displayName = profile?.full_name ?? session?.user?.email ?? "Admin"
  const displayEmail = profile?.email ?? session?.user?.email ?? "Signed in"
  const roleLabel = session?.primaryRole ? humanizeEnum(session.primaryRole) : "Admin"
  const passwordResetRequests = useSupportRequests({
    organizationId: organizationId ?? "",
    hostelId,
    status: "open",
    category: "account",
    workflow: "resident_password_reset",
    page: 1,
    pageSize: 1,
  })
  const operationalAlerts = useOperationalAlerts({
    organizationId: organizationId ?? undefined,
    hostelId,
  })
  const passwordResetCount = passwordResetRequests.data?.meta.total ?? 0
  const operationalAlertCount = operationalAlerts.data?.length ?? 0
  const operationalAlertTone = operationalAlerts.data?.some(
    (alert) => alert.severity === "critical"
  )
    ? "bg-destructive"
    : operationalAlertCount > 0
      ? "bg-warning"
      : "bg-success"
  const sidebarNotifications = [
    {
      title: "Password resets",
      href: "/admin/password-resets",
      count: passwordResetRequests.isLoading ? "..." : String(passwordResetCount),
      tone: passwordResetCount > 0 ? "bg-destructive" : "bg-success",
    },
    {
      title: "Operational alerts",
      href: "/admin/alerts",
      count: operationalAlerts.isLoading ? "..." : String(operationalAlertCount),
      tone: operationalAlertTone,
    },
    { title: "Launch readiness", href: "/admin/launch-readiness", count: "New", tone: "bg-info" },
  ] as const
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

  return (
    <motion.aside
      data-collapsed={collapsed}
      initial={false}
      animate={{ width: collapsed ? 88 : 288 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="peer/admin-sidebar fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl lg:block"
    >
      <div className="flex h-full flex-col">
        <div className={cn("border-b border-sidebar-border px-4 py-4", collapsed && "px-3")}>
          <Link
            href="/admin/dashboard"
            className={cn(
              "group flex items-center gap-3 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40",
              collapsed && "justify-center"
            )}
            aria-label={`${hostelConfig.name} admin dashboard`}
            title={collapsed ? hostelConfig.shortName : undefined}
          >
            <motion.span
              whileHover={{ rotate: -4, scale: 1.05 }}
            >
              <BrandMark
                logoUrl={logoUrl}
                variant="sidebar"
                className="size-11"
              />
            </motion.span>
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0"
                >
                  <span className="block truncate text-sm font-semibold text-sidebar-foreground">
                    {hostelConfig.shortName}
                  </span>
                  <span className="block truncate text-xs text-sidebar-foreground/60">
                    Admin Workspace
                  </span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </Link>

          <div className={cn("mt-4 flex items-center justify-between gap-3", collapsed && "justify-center")}>
            {!collapsed ? <Badge variant="secondary">Admin</Badge> : null}
            {!collapsed ? (
              <span className="truncate text-xs text-sidebar-foreground/60">
                {hostelConfig.location.city}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto border border-sidebar-border bg-white/[0.06] text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
          </div>
        </div>

        <div className={cn("border-b border-sidebar-border px-3 py-3", collapsed && "px-2")}>
          <AnimatePresence initial={false}>
            {!collapsed ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mb-2 flex items-center justify-between"
              >
                <span className="text-[11px] font-medium uppercase text-sidebar-foreground/45">
                  Quick actions
                </span>
                <Sparkles className="size-3.5 text-sidebar-primary" aria-hidden="true" />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className={cn("grid gap-1", collapsed ? "grid-cols-1" : "grid-cols-3")}>
            {quickActions.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "group flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sidebar-border bg-white/[0.06] px-2 text-xs font-medium text-sidebar-foreground/72 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-lg hover:shadow-cyan-950/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40",
                    collapsed && "size-10 px-0"
                  )}
                >
                  <Icon
                    className="size-4 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110"
                    aria-hidden="true"
                  />
                  {!collapsed ? <span className="truncate">{item.title.split(" ")[0]}</span> : null}
                </Link>
              )
            })}
          </div>
        </div>

        <nav
          className={cn("flex-1 space-y-1 overflow-y-auto px-3 py-4", collapsed && "px-2")}
          aria-label="Admin navigation"
        >
          {adminNavigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isActiveRoute(pathname, item.href)
            const itemCount =
              item.href === "/admin/password-resets" && passwordResetCount > 0
                ? passwordResetCount
                : null

            return (
              <motion.div key={item.href} layout>
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.title : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/68 transition-all duration-200 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40",
                  collapsed && "justify-center px-0",
                  isActive &&
                    "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_28px_-10px_var(--sidebar-primary)]",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="admin-sidebar-active"
                    className="absolute inset-0 rounded-xl ring-1 ring-sidebar-primary/70"
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-lg transition-colors duration-200",
                    isActive ? "bg-black/10" : "group-hover:bg-white/[0.08]"
                  )}
                >
                  <Icon
                    className="size-4 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110"
                    aria-hidden="true"
                  />
                </span>
                <AnimatePresence initial={false}>
                  {!collapsed ? (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.16 }}
                      className="relative min-w-0 flex-1 truncate"
                    >
                      {item.title}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                {isActive && !collapsed ? (
                  <span className="relative size-1.5 rounded-full bg-sidebar-primary-foreground/80 shadow-[0_0_12px_currentColor]" />
                ) : null}
                {itemCount && !collapsed ? (
                  <span className="relative rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                    {itemCount}
                  </span>
                ) : null}
                {itemCount && collapsed ? (
                  <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive shadow-[0_0_12px_var(--destructive)]" />
                ) : null}
              </Link>
              {item.children && isActive && !collapsed ? (
                <div className="ml-4 mt-1 grid gap-1 border-l border-sidebar-border pl-3">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon
                    const childActive = pathname === child.href

                    return (
                      <Link
                        key={child.href}
                        href={child.href as Route}
                        aria-current={childActive ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-sidebar-foreground/58 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40",
                          childActive && "bg-white/[0.08] text-sidebar-foreground"
                        )}
                      >
                        <ChildIcon className="size-3.5" aria-hidden="true" />
                        <span className="truncate">{child.title}</span>
                      </Link>
                    )
                  })}
                </div>
              ) : null}
              </motion.div>
            )
          })}
        </nav>

        <div className={cn("space-y-3 border-t border-sidebar-border p-4", collapsed && "p-2")}>
          <div className="rounded-xl border border-sidebar-border bg-white/[0.07] p-3 backdrop-blur">
            <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
              <span className="relative flex size-2.5 rounded-full bg-success shadow-[0_0_14px_var(--success)]" />
              {!collapsed ? (
                <p className="truncate text-xs font-medium text-sidebar-foreground">
                  Notifications
                </p>
              ) : null}
            </div>
            {!collapsed ? (
              <div className="mt-3 grid gap-2">
                {sidebarNotifications.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs text-sidebar-foreground/64 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-primary-foreground", item.tone)}>
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "rounded-xl border border-sidebar-border bg-white/[0.07] p-3 backdrop-blur",
              collapsed && "p-2"
            )}
          >
            <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
              <Avatar className="size-9 border border-sidebar-border">
                <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-sidebar-foreground">{displayName}</p>
                  <p className="truncate text-[11px] text-sidebar-foreground/52">{displayEmail}</p>
                </div>
              ) : null}
            </div>
            {!collapsed ? (
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant="secondary">{roleLabel}</Badge>
                <span className="text-[11px] text-sidebar-foreground/52">
                  {hostelConfig.location.city}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.aside>
  )
}
