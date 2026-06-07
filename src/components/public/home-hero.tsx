import {
  callHref,
  HOSTEL_TOTAL_CAPACITY,
  hostelConfig,
  mapSearchHref,
  whatsappHref,
} from "@/constants/hostel"
import { hostelImages } from "@/constants/hostel-images"
import { buildMapNavigationUrl } from "@/lib/public-gallery"
import type { GalleryItem } from "@/types/frontend"

const trustSignals = [
  `${HOSTEL_TOTAL_CAPACITY}+ Residents`,
  "Safe Environment",
  "WiFi Available",
  "Affordable Monthly Fees",
] as const

const ratingSignals = ["4.8 Rating", "Trusted by Students"] as const

const quickBenefits = ["24/7 Security", "High-Speed WiFi", "Quality Food", "Daily Cleaning"] as const

export function HomeHero({
  heroTitle = hostelConfig.name,
  heroSubtitle = `Safe, neat, and affordable accommodation for students and working professionals in ${hostelConfig.location.city}.`,
  galleryItems,
  mapLink,
}: {
  heroTitle?: string | null
  heroSubtitle?: string | null
  galleryItems?: GalleryItem[]
  mapLink?: string | null
}) {
  void galleryItems
  const heroImageUrl = hostelImages.hero
  const locationHref = buildMapNavigationUrl(mapLink) || mapSearchHref
  const startingFee = hostelConfig.fees.student.toLocaleString("en-IN")

  return (
    <section
      className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b bg-slate-950 bg-cover bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(15,23,42,0.82)_46%,rgba(15,23,42,0.52)_100%),linear-gradient(180deg,rgba(2,6,23,0.2)_0%,rgba(2,6,23,0.72)_100%),url(${heroImageUrl})`,
      }}
    >
      <div className="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-background to-transparent" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 md:pb-20 md:pt-20 lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-xl">
            <span className="size-2 rounded-full bg-blue-400" aria-hidden="true" />
            {hostelConfig.location.city}, {hostelConfig.location.state}
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {heroTitle || hostelConfig.name}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Hostel rating and student trust">
            {ratingSignals.map((label) => (
              <span
                key={label}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/35 bg-slate-950/55 px-3.5 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-md"
              >
                <span className="size-2 rounded-full bg-amber-300" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <div className="mt-4 flex max-w-4xl flex-wrap gap-2" aria-label="Hostel trust signals">
            {trustSignals.map((signal) => (
              <span
                key={signal}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/18 bg-white/12 px-3 py-1.5 text-sm font-medium text-white shadow-sm backdrop-blur-md"
              >
                <span className="size-2 rounded-full bg-emerald-300" aria-hidden="true" />
                {signal}
              </span>
            ))}
          </div>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
            {heroSubtitle}
          </p>

          <div className="mt-4 inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-300 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-sm sm:text-base">
            <span className="shrink-0" aria-hidden="true">Rs</span>
            <span className="break-words">Rooms Starting From ₹{startingFee}/month</span>
          </div>

          <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
            <a
              href={callHref}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/60 sm:w-auto"
              aria-label={`Call ${hostelConfig.name}`}
            >
              Call Now
            </a>
            <a
              href="/admissions"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-white/15 bg-white px-5 text-sm font-medium text-slate-950 shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/60 sm:w-auto"
              aria-label={`Apply for admission at ${hostelConfig.name}`}
            >
              Apply For Admission
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#0b6b3a] px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#086033] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/60 sm:w-auto"
              aria-label={`Message ${hostelConfig.name} on WhatsApp`}
            >
              WhatsApp
            </a>
            <a
              href={locationHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-white/55 bg-slate-950/25 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/60 sm:w-auto"
              aria-label={`View ${hostelConfig.name} on map`}
            >
              View on Map
            </a>
          </div>

          <div className="mt-5 grid max-w-4xl grid-cols-1 gap-2 sm:flex sm:flex-wrap" aria-label="Quick hostel benefits">
            {quickBenefits.map((label) => (
              <span
                key={label}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/16 bg-slate-950/45 px-3 py-2 pr-14 text-sm font-medium text-white shadow-sm backdrop-blur-md sm:pr-3"
              >
                <span className="size-2 shrink-0 rounded-full bg-sky-200" aria-hidden="true" />
                <span className="min-w-0">{label}</span>
              </span>
            ))}
          </div>
        </div>

      </div>

      <FloatingWhatsAppButton
        href={whatsappHref}
        label={`Message ${hostelConfig.name} on WhatsApp`}
      />
    </section>
  )
}

function FloatingWhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="fixed bottom-4 right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0b6b3a] p-0 text-sm font-semibold text-white shadow-[0_18px_38px_-18px_rgba(0,0,0,0.75)] transition-colors hover:bg-[#086033] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:bottom-6 sm:right-6 sm:w-auto sm:gap-2 sm:px-4 sm:py-3"
    >
      <span aria-hidden="true">WA</span>
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  )
}
