import type { ReactNode } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { publicNavigation } from "@/constants/navigation"
import { siteConfig } from "@/data/site"

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
              SB
            </span>
            <span>{siteConfig.name}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {publicNavigation.map((item) => (
              <Button key={item.href} asChild variant="ghost" size="sm">
                <Link href={item.href}>{item.title}</Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/resident/dashboard">Resident</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/dashboard">Admin</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>{siteConfig.name}</p>
          <p>Prepared for CMS, Supabase, payments, invoices, and multi-hostel growth.</p>
        </div>
      </footer>
    </div>
  )
}
