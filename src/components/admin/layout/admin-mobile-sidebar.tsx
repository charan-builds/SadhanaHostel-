"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"

import { adminNavigationItems } from "@/components/admin/layout/admin-sidebar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { hostelConfig } from "@/constants/hostel"
import { cn } from "@/lib/utils"

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminMobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

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
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-lg">
              SB
            </span>
            <span>{hostelConfig.shortName}</span>
          </SheetTitle>
          <SheetDescription>Admin dashboard navigation</SheetDescription>
        </SheetHeader>

        <nav className="grid gap-1 px-3 py-4" aria-label="Mobile admin navigation">
          {adminNavigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href as Route}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:translate-x-0.5 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  isActive && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.title}
              </Link>
            )
          })}
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
