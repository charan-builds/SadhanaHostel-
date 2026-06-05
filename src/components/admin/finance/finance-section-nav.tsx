"use client"

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import {
  ClipboardCheck,
  Gauge,
  History,
  ReceiptText,
  RefreshCcw,
} from "lucide-react"

import { cn } from "@/lib/utils"

const financeSections = [
  { title: "Dashboard", href: "/admin/finance", icon: Gauge },
  { title: "Collections", href: "/admin/finance/collections", icon: ClipboardCheck },
  { title: "Followups", href: "/admin/finance/followups", icon: History },
  { title: "Receipts", href: "/admin/finance/receipts", icon: ReceiptText },
  { title: "Reconciliation", href: "/admin/finance/reconciliation", icon: RefreshCcw },
] as const

export function FinanceSectionNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Finance sections"
      className="sticky top-0 z-10 border-b bg-background/92 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6"
    >
      <div className="mx-auto flex max-w-screen-2xl gap-2 overflow-x-auto">
        {financeSections.map((section) => {
          const Icon = section.icon
          const active =
            pathname === section.href ||
            (section.href !== "/admin/finance" && pathname.startsWith(`${section.href}/`))

          return (
            <Link
              key={section.href}
              href={section.href as Route}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {section.title}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
