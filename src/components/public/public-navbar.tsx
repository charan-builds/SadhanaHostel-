import { BrandMark } from "@/components/shared/brand-mark"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { publicNavItems } from "@/constants/public-content"

export function PublicNavbar({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-18">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
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
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary public navigation">
          {publicNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {item.title}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={callHref}
            className="hidden h-7 items-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 md:inline-flex"
            aria-label={`Call ${hostelConfig.name}`}
          >
            Call
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="hidden h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 md:inline-flex"
            aria-label={`Message ${hostelConfig.name} on WhatsApp`}
          >
            WhatsApp
          </a>
          <a
            href="/resident/login"
            className="hidden h-7 items-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 md:inline-flex"
          >
            Resident
          </a>
          <a
            href="/admin/login"
            className="hidden h-7 items-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 md:inline-flex"
          >
            Admin
          </a>
          <details className="relative lg:hidden">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border/80 bg-background/80 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
              <span className="grid gap-1" aria-hidden="true">
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
              </span>
              <span className="sr-only">Open public navigation menu</span>
            </summary>
            <div className="absolute right-0 top-11 z-50 grid w-64 gap-1 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lifted">
              {publicNavItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  {item.title}
                </a>
              ))}
              <div className="my-1 border-t" />
              <a href="/resident/login" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                Resident
              </a>
              <a href="/admin/login" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                Admin
              </a>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
