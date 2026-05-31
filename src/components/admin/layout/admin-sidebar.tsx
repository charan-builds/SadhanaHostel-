"use client"

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BedDouble,
  Bot,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  CreditCard,
  GalleryHorizontalEnd,
  Globe,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Fingerprint,
  Settings,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { hostelConfig } from "@/constants/hostel"
import { cn } from "@/lib/utils"

export type AdminNavigationItem = {
  title: string
  href: string
  icon: LucideIcon
}

export const adminNavigationItems: AdminNavigationItem[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Owner Dashboard", href: "/admin/owner-dashboard", icon: BarChart3 },
  { title: "Leads", href: "/admin/leads", icon: UserRoundPlus },
  { title: "Reservations", href: "/admin/reservations", icon: CalendarCheck },
  { title: "Vacancy", href: "/admin/vacancy", icon: BedDouble },
  { title: "Residents", href: "/admin/residents", icon: Users },
  { title: "Verification", href: "/admin/residents/verification", icon: ShieldCheck },
  { title: "Rooms", href: "/admin/rooms", icon: Building2 },
  { title: "Payments", href: "/admin/payments", icon: CreditCard },
  { title: "Payment Security", href: "/admin/finance/payment-security", icon: ShieldCheck },
  { title: "Leaves", href: "/admin/leaves", icon: CalendarDays },
  { title: "Notices", href: "/admin/notices", icon: ClipboardList },
  { title: "Website CMS", href: "/admin/website", icon: Globe },
  { title: "Gallery", href: "/admin/gallery", icon: GalleryHorizontalEnd },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Alerts", href: "/admin/alerts", icon: LifeBuoy },
  { title: "Launch Readiness", href: "/admin/launch-readiness", icon: ClipboardCheck },
  { title: "Automation", href: "/admin/operations/automation", icon: Bot },
  { title: "Identity Repair", href: "/admin/operations/identity-repair", icon: Fingerprint },
  { title: "Reset Demo Data", href: "/admin/operations/reset-demo-data", icon: Trash2 },
  { title: "Staff & Access", href: "/admin/settings/staff-access", icon: KeyRound },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40"
            aria-label={`${hostelConfig.name} admin dashboard`}
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground shadow-lg shadow-cyan-950/20">
              SB
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-sidebar-foreground">
                {hostelConfig.shortName}
              </span>
              <span className="block truncate text-xs text-sidebar-foreground/60">Admin Workspace</span>
            </span>
          </Link>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Badge variant="secondary">Admin</Badge>
            <span className="text-xs text-sidebar-foreground/60">{hostelConfig.location.city}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
          {adminNavigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/68 transition-all duration-200 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40",
                  isActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-cyan-950/20",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl border border-sidebar-border bg-white/[0.07] p-3 backdrop-blur">
            <p className="text-xs font-medium text-sidebar-foreground">{hostelConfig.name}</p>
            <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">
              Hostel operations dashboard
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
