"use client"

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { MessageCircle, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { publicNavItems } from "@/data/public"
import { cn } from "@/lib/utils"
import { PublicMobileMenu } from "@/components/public/public-mobile-menu"

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function PublicNavbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-18">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${hostelConfig.name} home`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            SB
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-5 text-foreground sm:text-base">
              {hostelConfig.name}
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              {hostelConfig.location.city}, {hostelConfig.location.state}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary public navigation">
          {publicNavItems.map((item) => {
            const isActive = isActivePath(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href as Route}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive && "bg-primary/10 text-primary",
                )}
              >
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <a href={callHref} aria-label={`Call ${hostelConfig.name}`}>
              <Phone className="size-4" aria-hidden="true" />
              Call
            </a>
          </Button>
          <Button asChild size="sm" className="hidden md:inline-flex">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`Message ${hostelConfig.name} on WhatsApp`}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
          <PublicMobileMenu currentPathname={pathname} />
        </div>
      </div>
    </header>
  )
}
