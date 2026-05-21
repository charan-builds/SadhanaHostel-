import { MapPin, Navigation, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { callHref, hostelConfig, mapSearchHref } from "@/constants/hostel"

export function LocationCta() {
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
              <a href={mapSearchHref} target="_blank" rel="noreferrer">
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

        <div className="min-h-72 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#dbeafe_0%,#f8fafc_55%,#e2e8f0_100%)]">
            <div className="max-w-sm px-6 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
                <MapPin className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">
                Open location map
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use the navigation button to open the exact hostel location.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
