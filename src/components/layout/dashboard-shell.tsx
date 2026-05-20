import type { ReactNode } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { siteConfig } from "@/data/site"
import type { NavItem } from "@/types/navigation"

type DashboardShellProps = {
  area: "admin" | "resident"
  title: string
  description: string
  navigation: NavItem[]
  children: ReactNode
}

export function DashboardShell({
  area,
  title,
  description,
  navigation,
  children,
}: DashboardShellProps) {
  const areaLabel = area === "admin" ? "Admin" : "Resident"

  return (
    <div className="flex min-h-svh bg-muted/20">
      <aside className="hidden w-72 shrink-0 border-r bg-background lg:block">
        <div className="flex h-full flex-col gap-6 p-5">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
              SB
            </span>
            <span>{siteConfig.shortName}</span>
          </Link>

          <div>
            <Badge variant="secondary">{areaLabel}</Badge>
            <h1 className="mt-3 text-lg font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>

          <Separator />

          <nav className="grid gap-1">
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  className="justify-start gap-2"
                >
                  <Link href={item.href}>
                    {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                    {item.title}
                  </Link>
                </Button>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-background lg:hidden">
          <div className="flex h-16 items-center justify-between px-6">
            <Link href="/" className="font-semibold">
              {siteConfig.shortName}
            </Link>
            <Badge variant="secondary">{areaLabel}</Badge>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
