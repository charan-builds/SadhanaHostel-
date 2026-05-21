import Link from "next/link"
import type { Route } from "next"
import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, mapSearchHref, whatsappHref } from "@/constants/hostel"
import { publicNavItems } from "@/constants/public-content"

const quickLinks = publicNavItems.filter((item) =>
  ["/", "/about", "/rooms", "/facilities", "/gallery"].includes(item.href),
)

const importantLinks = publicNavItems.filter((item) => ["/contact", "/terms"].includes(item.href))

export function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/25">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.25fr_0.75fr_0.75fr] lg:py-14">
        <div className="max-w-xl">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`${hostelConfig.name} home`}
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              SB
            </span>
            <span className="font-semibold text-foreground">{hostelConfig.name}</span>
          </Link>

          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
            A practical and well-managed hostel stay for students and employees in{" "}
            {hostelConfig.location.city}.
          </p>

          <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p>{hostelConfig.location.address}</p>
                <p className="mt-1 font-medium text-foreground">{hostelConfig.location.note}</p>
              </div>
            </div>
            <a
              href={callHref}
              className="flex w-fit items-center gap-3 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Phone className="size-4 text-primary" aria-hidden="true" />
              <span>{hostelConfig.contact.phone}</span>
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-3 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MessageCircle className="size-4 text-primary" aria-hidden="true" />
              <span>{hostelConfig.contact.whatsapp}</span>
            </a>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <a href={callHref}>
                <Phone className="size-4" aria-hidden="true" />
                Call
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={mapSearchHref} target="_blank" rel="noreferrer">
                <Navigation className="size-4" aria-hidden="true" />
                Navigate
              </a>
            </Button>
          </div>
        </div>

        <nav aria-label="Footer quick links">
          <h2 className="text-sm font-semibold text-foreground">Quick links</h2>
          <ul className="mt-4 grid gap-2">
            {quickLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href as Route}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer important links">
          <h2 className="text-sm font-semibold text-foreground">Important links</h2>
          <ul className="mt-4 grid gap-2">
            {importantLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href as Route}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            Copyright {year} {hostelConfig.name}. All rights reserved.
          </p>
          <p>
            {hostelConfig.location.city}, {hostelConfig.location.state},{" "}
            {hostelConfig.location.country}
          </p>
        </div>
      </div>
    </footer>
  )
}
