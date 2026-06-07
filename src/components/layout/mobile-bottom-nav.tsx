"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import type { NavItem } from "@/types/navigation"

export function MobileBottomNav({ navigation }: { navigation: NavItem[] }) {
  const pathname = usePathname()
  const residentTabs = [
    { href: "/resident/dashboard", title: "Home" },
    { href: "/resident/payments", title: "Pay" },
    { href: "/resident/notices", title: "Notices" },
    { href: "/resident/profile", title: "Profile" },
  ]
  const primaryItems = residentTabs
    .map((tab) => {
      const item = navigation.find((navItem) => String(navItem.href) === tab.href)

      return item ? { ...item, title: tab.title } : null
    })
    .filter((item): item is NavItem => Boolean(item))

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/90 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-lg backdrop-blur-2xl lg:hidden"
      aria-label="Resident quick navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {primaryItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

          return (
            <Button
              key={item.href}
              asChild
              variant={isActive ? "secondary" : "ghost"}
              className="h-14 min-w-0 flex-col gap-1 px-1 text-[11px]"
              aria-current={isActive ? "page" : undefined}
            >
              <Link href={item.href}>
                {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                <span className="max-w-full truncate">{item.title}</span>
              </Link>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
