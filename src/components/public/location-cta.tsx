import { callHref, hostelConfig, mapSearchHref } from "@/constants/hostel"
import { buildMapNavigationUrl } from "@/lib/public-gallery"

export function LocationCta({ mapLink }: { mapLink?: string | null }) {
  const locationHref = buildMapNavigationUrl(mapLink) || mapSearchHref

  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-blue-700">Location</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 text-balance sm:text-4xl">
            Boys hostel location in {hostelConfig.location.city}.
          </h2>
          <div className="mt-5 flex gap-3 text-slate-700">
            <span className="mt-3 size-2 shrink-0 rounded-full bg-blue-700" aria-hidden="true" />
            <div>
              <p className="leading-7">{hostelConfig.location.address}</p>
              <p className="mt-2 font-medium text-slate-950">{hostelConfig.location.note}</p>
            </div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href={locationHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Navigate
            </a>
            <a
              href={callHref}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Call
            </a>
            <a
              href="/pulivendula-boys-hostel"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Hostel details
            </a>
          </div>
        </div>

        <div className="grid min-h-72 place-items-center rounded-2xl border bg-white p-6 text-center shadow-sm">
          <div>
            <span className="mx-auto block size-10 rounded-full bg-blue-700/10" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-semibold text-slate-950">Open the hostel map</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              View directions and nearby roads in Google Maps when you are ready to visit.
            </p>
            <a
              href={locationHref}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Open Map
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
