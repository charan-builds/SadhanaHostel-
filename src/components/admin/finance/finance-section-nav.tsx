import Link from "next/link"
import type { Route } from "next"
import {
  ClipboardCheck,
  Gauge,
  History,
  ReceiptText,
  RefreshCcw,
} from "lucide-react"

const financeSections = [
  { title: "Dashboard", href: "/admin/finance", icon: Gauge },
  { title: "Collections", href: "/admin/finance/collections", icon: ClipboardCheck },
  { title: "Followups", href: "/admin/finance/followups", icon: History },
  { title: "Receipts", href: "/admin/finance/receipts", icon: ReceiptText },
  { title: "Reconciliation", href: "/admin/finance/reconciliation", icon: RefreshCcw },
] as const

export function FinanceSectionNav() {
  return (
    <nav
      aria-label="Finance sections"
      className="sticky top-0 z-10 border-b bg-background/92 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6"
    >
      <div className="mx-auto flex max-w-screen-2xl gap-2 overflow-x-auto">
        {financeSections.map((section) => {
          const Icon = section.icon

          return (
            <Link
              key={section.href}
              href={section.href as Route}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
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
