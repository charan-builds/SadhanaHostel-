import { Building2, CheckCircle2, MapPin, MessageCircle, Navigation, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, mapSearchHref, whatsappHref } from "@/constants/hostel"
import { fallbackRoomTypes } from "@/constants/public-content"
import type { RoomTypeCard } from "@/types/frontend"

const trustBadges = [
  hostelConfig.location.note,
  "CCTV monitored premises",
  "Students and employees welcome",
] as const

export function HomeHero({
  heroTitle = hostelConfig.name,
  heroSubtitle = `Safe, neat, and affordable accommodation for students and working professionals in ${hostelConfig.location.city}.`,
  roomTypes = fallbackRoomTypes,
}: {
  heroTitle?: string | null
  heroSubtitle?: string | null
  roomTypes?: RoomTypeCard[]
}) {
  return (
    <section className="relative overflow-hidden border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_72%)]">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:44px_44px]" />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
            <MapPin className="size-3.5 text-blue-600" aria-hidden="true" />
            {hostelConfig.location.city}, {hostelConfig.location.state}
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 text-balance sm:text-5xl lg:text-6xl">
            {heroTitle || hostelConfig.name}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
            {heroSubtitle}
          </p>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Located near Loyola Polytechnic College, {hostelConfig.name} provides comfortable
            rooms, tasty food, WiFi, CCTV, water facility, and a clean environment.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="h-11 px-4">
              <a href={callHref} aria-label={`Call ${hostelConfig.name}`}>
                <Phone className="size-4" aria-hidden="true" />
                Call Now
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 bg-white px-4">
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
            <Button asChild variant="outline" size="lg" className="h-11 bg-white px-4">
              <a
                href={mapSearchHref}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${hostelConfig.name} on map`}
              >
                <Navigation className="size-4" aria-hidden="true" />
                View on Map
              </a>
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {trustBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
              >
                <CheckCircle2 className="size-3.5 text-blue-600" aria-hidden="true" />
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-xl shadow-slate-200/70">
          <div className="overflow-hidden rounded-xl border bg-slate-950 text-white">
            <div className="bg-[linear-gradient(135deg,#1d4ed8_0%,#0f172a_72%)] px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-100">
                    Hostel building
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">{hostelConfig.shortName}</h2>
                </div>
                <Building2 className="size-8 text-blue-100" aria-hidden="true" />
              </div>
            </div>

            <div className="grid gap-3 p-5">
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-12 rounded-md border border-white/10 bg-white/15 shadow-inner"
                  />
                ))}
              </div>
              <div className="mt-2 grid gap-3 rounded-lg bg-white p-4 text-slate-950 sm:grid-cols-2">
                {roomTypes.map((room) => (
                  <div key={room.title} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-medium text-slate-500">{room.title}</p>
                    <p className="mt-1 text-lg font-semibold">{room.priceLabel}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
