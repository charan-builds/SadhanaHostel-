import type { ReactNode } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardUserActions } from "@/components/layout/dashboard-user-actions"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { hostelConfig } from "@/constants/hostel"
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
    <div className="saas-grid-bg flex min-h-svh bg-background">
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl lg:block">
        <div className="flex h-full flex-col gap-6 p-5">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sm text-sidebar-primary-foreground shadow-lg">
              SB
            </span>
            <span>{hostelConfig.shortName}</span>
          </Link>

          <div>
            <Badge variant="secondary">{areaLabel}</Badge>
            <h1 className="mt-3 text-lg font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-sidebar-foreground/62">{description}</p>
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
                  className="justify-start gap-2 text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Link href={item.href}>
                    {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                    {item.title}
                  </Link>
                </Button>
              )
            })}
          </nav>

          <div className="mt-auto">
            <DashboardUserActions />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-white/70 bg-white/78 shadow-sm shadow-slate-950/5 backdrop-blur-2xl lg:hidden">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">
                SB
              </span>
              {hostelConfig.shortName}
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{areaLabel}</Badge>
              <DashboardUserActions />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open navigation">
                    <Menu className="size-4" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>{areaLabel} Navigation</SheetTitle>
                  </SheetHeader>
                  <nav className="grid gap-1 px-4" aria-label={`${areaLabel} navigation`}>
                    {navigation.map((item) => {
                      const Icon = item.icon

                      return (
                        <SheetClose key={item.href} asChild>
                          <Button
                            asChild
                            variant="ghost"
                            className="h-11 justify-start gap-2"
                          >
                            <Link href={item.href}>
                              {Icon ? (
                                <Icon className="size-4" aria-hidden="true" />
                              ) : null}
                              {item.title}
                            </Link>
                          </Button>
                        </SheetClose>
                      )
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 pb-24 sm:px-6 lg:py-8 lg:pb-8">
          {children}
        </main>

        {area === "resident" ? (
          <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/86 px-2 py-2 shadow-lg backdrop-blur-2xl lg:hidden"
            aria-label="Resident quick navigation"
          >
            <div className="mx-auto flex max-w-md gap-1 overflow-x-auto">
              {navigation.map((item) => {
                const Icon = item.icon

                return (
                  <Button
                    key={item.href}
                    asChild
                  variant="ghost"
                    className="h-14 min-w-16 flex-col gap-1 px-1 text-[11px]"
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
        ) : null}
      </div>
    </div>
  )
}
