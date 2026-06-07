"use client"

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { MessageCircle, Phone } from "lucide-react"

import { BrandMark } from "@/components/shared/brand-mark"
import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { publicNavItems } from "@/constants/public-content"
import {
  trackContactAction,
  trackWhatsAppClick,
} from "@/lib/analytics/google-analytics"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/public/language-switcher"
import { PublicMobileMenu } from "@/components/public/public-mobile-menu"
import { PublicAuthActions } from "@/components/public/public-auth-actions"

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function PublicNavbar({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-18">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${hostelConfig.name} home`}
        >
          <BrandMark logoUrl={logoUrl} />
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
            <a
              href={callHref}
              aria-label={`Call ${hostelConfig.name}`}
              onClick={() => trackContactAction("phone", "public_navbar")}
            >
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
              onClick={() => {
                trackContactAction("whatsapp", "public_navbar")
                trackWhatsAppClick("public_navbar")
              }}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
          <LanguageSwitcher className="hidden xl:flex" />
          <PublicAuthActions className="hidden md:inline-flex" />
          <LanguageSwitcher compact className="lg:hidden" />
          <PublicMobileMenu currentPathname={pathname} logoUrl={logoUrl} />
        </div>
      </div>
    </header>
  )
}
