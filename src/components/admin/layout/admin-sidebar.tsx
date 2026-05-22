"use client"

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  GalleryHorizontalEnd,
  KeyRound,
  Globe,
  LayoutDashboard,
  Settings,
  ShieldCheck,
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
  { title: "Staff & Access", href: "/admin/settings/staff-access", icon: KeyRound },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-white lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b px-5 py-5">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`${hostelConfig.name} admin dashboard`}
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
              SB
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-950">
                {hostelConfig.shortName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">Admin Workspace</span>
            </span>
          </Link>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Badge variant="secondary">Admin</Badge>
            <span className="text-xs text-muted-foreground">{hostelConfig.location.city}</span>
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive && "bg-blue-50 text-blue-700 shadow-sm",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-950">{hostelConfig.name}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Hostel operations dashboard
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
