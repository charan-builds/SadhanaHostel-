import { BrandMark } from "@/components/shared/brand-mark"
import { callHref, hostelConfig, mapSearchHref, whatsappHref } from "@/constants/hostel"
import { localSeoLandingLinks, publicNavItems } from "@/constants/public-content"

const quickLinks = publicNavItems.filter((item) =>
  ["/", "/about", "/rooms", "/facilities", "/gallery"].includes(item.href),
)

const importantLinks = [
  ...publicNavItems.filter((item) => ["/contact"].includes(item.href)),
  { title: "Admissions", href: "/admissions" },
  { title: "Fees", href: "/fees" },
  { title: "Privacy", href: "/privacy" },
  { title: "Terms", href: "/terms" },
]

export function PublicFooter({ logoUrl }: { logoUrl?: string | null }) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/25">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.25fr_0.75fr_0.75fr] lg:py-14">
        <div className="max-w-xl">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`${hostelConfig.name} home`}
          >
            <BrandMark logoUrl={logoUrl} />
            <span className="font-semibold text-foreground">{hostelConfig.name}</span>
          </a>

          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
            A practical and well-managed hostel stay for students and employees in{" "}
            {hostelConfig.location.city}.
          </p>

          <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <div>
                <p>{hostelConfig.location.address}</p>
                <p className="mt-1 font-medium text-foreground">{hostelConfig.location.note}</p>
              </div>
            </div>
            <a
              href={callHref}
              className="flex w-fit items-center gap-3 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span>{hostelConfig.contact.phone}</span>
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-3 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span>{hostelConfig.contact.whatsapp}</span>
            </a>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href={callHref}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Call
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              WhatsApp
            </a>
            <a
              href={mapSearchHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Navigate
            </a>
          </div>
        </div>

        <nav aria-label="Footer quick links">
          <h2 className="text-sm font-semibold text-foreground">Quick links</h2>
          <ul className="mt-4 grid gap-2">
            {quickLinks.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer important links">
          <h2 className="text-sm font-semibold text-foreground">Important links</h2>
          <ul className="mt-4 grid gap-2">
            {importantLinks.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.title}
                </a>
              </li>
            ))}
            {localSeoLandingLinks.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.title}
                </a>
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
