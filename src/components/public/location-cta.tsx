import { MapPin, Navigation, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, mapSearchHref } from "@/constants/hostel"
import { buildMapEmbedUrl, buildMapNavigationUrl } from "@/lib/public-gallery"

export function LocationCta({ mapLink }: { mapLink?: string | null }) {
  const locationHref = buildMapNavigationUrl(mapLink) || mapSearchHref

  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-700">Location</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
            Easy to find in {hostelConfig.location.city}.
          </h2>
          <div className="mt-5 flex gap-3 text-slate-700">
            <MapPin className="mt-1 size-5 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
              <p className="leading-7">{hostelConfig.location.address}</p>
              <p className="mt-2 font-medium text-slate-950">{hostelConfig.location.note}</p>
            </div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <a href={locationHref} target="_blank" rel="noreferrer">
                <Navigation className="size-4" aria-hidden="true" />
                Navigate
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={callHref}>
                <Phone className="size-4" aria-hidden="true" />
                Call
              </a>
            </Button>
          </div>
        </div>

        <div className="min-h-72 overflow-hidden rounded-2xl border bg-white p-3 shadow-sm">
          <iframe
            title={`${hostelConfig.name} location map`}
            src={buildMapEmbedUrl(mapLink)}
            className="h-full min-h-72 w-full rounded-xl border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  )
}
