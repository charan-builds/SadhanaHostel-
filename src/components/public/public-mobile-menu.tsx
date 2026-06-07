"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { Menu, MessageCircle, Navigation, Phone } from "lucide-react"

import { BrandMark } from "@/components/shared/brand-mark"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { callHref, hostelConfig, mapSearchHref, whatsappHref } from "@/constants/hostel"
import { publicNavItems } from "@/constants/public-content"
import { cn } from "@/lib/utils"
import { PublicAuthActions } from "@/components/public/public-auth-actions"

type PublicMobileMenuProps = {
  currentPathname?: string
  logoUrl?: string | null
  defaultOpen?: boolean
}

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function PublicMobileMenu({
  currentPathname: providedCurrentPathname,
  logoUrl,
  defaultOpen = false,
}: PublicMobileMenuProps) {
  const [open, setOpen] = useState(defaultOpen)
  const pathname = usePathname()
  const currentPathname = providedCurrentPathname ?? pathname

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon-lg"
          className="lg:hidden"
          aria-label="Open public navigation menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[88vw] max-w-sm overflow-y-auto p-0" aria-label="Public navigation">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle className="flex items-center gap-3">
            <BrandMark logoUrl={logoUrl} />
            <span>{hostelConfig.shortName}</span>
          </SheetTitle>
          <SheetDescription>{hostelConfig.location.note}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 px-5 py-5">
          <nav className="grid gap-1" aria-label="Mobile public navigation">
            {publicNavItems.map((item) => {
              const isActive = isActivePath(currentPathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive && "bg-primary/10 text-primary",
                  )}
                >
                  {item.title}
                </Link>
              )
            })}
          </nav>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Visit or contact</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {hostelConfig.location.address}
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {hostelConfig.location.note}
            </p>
          </div>

          <div className="grid gap-2">
            <PublicAuthActions mode="mobile" onNavigate={() => setOpen(false)} />
            <Button asChild className="justify-start">
              <a href={callHref} onClick={() => setOpen(false)}>
                <Phone className="size-4" aria-hidden="true" />
                Call {hostelConfig.contact.phone}
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <a
                href={mapSearchHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
              >
                <Navigation className="size-4" aria-hidden="true" />
                View on Map
              </a>
            </Button>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
