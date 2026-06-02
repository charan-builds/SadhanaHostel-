import Link from "next/link"
import type { Route } from "next"
import { ArrowRight, MapPin } from "lucide-react"

import { hostelConfig } from "@/constants/hostel"
import { localSeoLandingLinks } from "@/constants/public-content"

export function LocalSearchLinks() {
  return (
    <section className="border-y bg-slate-50 px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            <MapPin className="size-4" aria-hidden="true" />
            {hostelConfig.location.city} hostel searches
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Find the right Sadhana Boys Hostel stay in Pulivendula.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Direct pages for boys hostel, student rooms, and employee accommodation with clear
            monthly fees and location details.
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {localSeoLandingLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              className="group rounded-xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                View page
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
